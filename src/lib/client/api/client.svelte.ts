import { browser } from "$app/environment";
import { goto } from "$app/navigation";
import { getAbortSignal, onDestroy } from "svelte";
import type { AppState } from "../state.svelte.js";
import { DEFAULT_RPC_STORE_KEY } from "../../shared/constants.js";
import type {
	ApiClientMethod,
	ApiClientOptions,
	ApiFormOptions,
	ApiInputValue,
	ApiQueryOptions,
	ApiQueryState,
	ApiStateShape,
	ClientFromRouter,
	ClientInvalidationPayload,
	RpcResponse,
	RpcRouter,
} from "./types.js";

const DEFAULT_CONNECTION_HEADER = "x-conduit-connection-id";

type UiPayload = {
	message?: string;
	navigate?: string;
} | null;

async function emitMessage(
	options: ApiClientOptions,
	message: string | undefined,
	type: "success" | "error",
) {
	if (!message) return;
	await options.onMessage?.(message, type);
}

function bindStateLifetime(state: ApiState<any, any>) {
	try {
		const signal = getAbortSignal();
		if (!signal.aborted) signal.addEventListener("abort", () => state.destroy(), { once: true });
		return;
	} catch {}
	try {
		onDestroy(() => state.destroy());
	} catch {}
}

function createRpcKey(path: string[], input: unknown) {
	return `${path.join("/")}::${JSON.stringify(input ?? null)}`;
}

function consumeHydratedRpc<T>(
	key: string,
	hydrationCache: Record<string, RpcResponse<unknown>> | undefined,
): RpcResponse<T> | null {
	if (!browser || !hydrationCache || !(key in hydrationCache)) return null;
	const cached = hydrationCache[key] as RpcResponse<T>;
	delete hydrationCache[key];
	return cached;
}

function toClientError(error: { message: string; status: number }) {
	const rpcError = new Error(error.message) as Error & { status?: number };
	rpcError.status = error.status;
	return rpcError;
}

function getDefaultHydrationCache() {
	if (!browser) return undefined;
	return ((((globalThis as any).window ??= {}).__RPC__ ??= {}) as Record<string, RpcResponse<unknown>>);
}

async function getRequestEvent(options: ApiClientOptions) {
	if (options.getRequestEvent) return options.getRequestEvent();
	const mod = await import("$app/server");
	return mod.getRequestEvent();
}

async function getApiFetch(options: ApiClientOptions) {
	if (options.fetch) return options.fetch;
	if (browser) return fetch;
	const event = await getRequestEvent(options);
	return event.fetch.bind(event);
}

async function rememberSsrRpc(
	key: string,
	result: RpcResponse<unknown>,
	options: ApiClientOptions,
) {
	if (browser) return;
	const event = await getRequestEvent(options);
	const storeKey = options.ssrStoreKey ?? DEFAULT_RPC_STORE_KEY;
	const locals = event.locals as Record<string, unknown>;
	const store = ((locals[storeKey] ??= {}) as Record<string, RpcResponse<unknown>>);
	store[key] = result;
}

async function callRpc<I, O>(
	appState: AppState<Record<string, unknown>>,
	path: string[],
	input: I,
	options: ApiClientOptions = {},
): Promise<RpcResponse<O>> {
	const key = createRpcKey(path, input);
	const cached = consumeHydratedRpc<O>(key, options.hydrationCache ?? getDefaultHydrationCache());
	if (cached) return cached;

	const fetchImpl = await getApiFetch(options);
	const headers = new Headers(typeof options.headers === "function" ? options.headers() : options.headers);
	const connectionId = appState.get("realtimeConnectionId");
	if (connectionId) headers.set(DEFAULT_CONNECTION_HEADER, connectionId);
	if (input !== undefined) headers.set("content-type", "application/json");

	const response = await fetchImpl(`${options.baseUrl ?? "/api/rpc"}/${path.join("/")}`, {
		method: "POST",
		headers,
		body: input !== undefined ? JSON.stringify(input) : undefined,
	});

	const result = (await response.json()) as RpcResponse<O>;
	await rememberSsrRpc(key, result, options);
	return result;
}

export function createApi<T extends RpcRouter>(
	appState: AppState<Record<string, unknown>>,
	options: ApiClientOptions = {},
): ClientFromRouter<T> {
	const makeNode = (path: string[]): any => {
		const method = ((...args: any[]) => {
			if (args.length > 1) throw new Error("RPC methods accept at most one argument");
			return callRpc(appState, path, args[0], options).then(async (response) => {
				if ("error" in response) {
					const error = toClientError(response.error);
					await emitMessage(options, error.message, "error");
					throw error;
				}

				if (response.invalidate) {
					await appState.invalidate(response.invalidate);
				}
				await emitMessage(options, (response.data as UiPayload)?.message, "success");
				return response.data;
			});
		}) as ApiClientMethod<any, any>;

		method.safe = (...args: any[]) =>
			callRpc(appState, path, args[0], options)
				.then(async (response) => {
					if ("error" in response) {
						const error = toClientError(response.error);
						await emitMessage(options, error.message, "error");
						return { data: null, error };
					}

					if (response.invalidate) {
						await appState.invalidate(response.invalidate);
					}
					await emitMessage(options, (response.data as UiPayload)?.message, "success");
					return { data: response.data, error: null };
				})
				.catch((error: any) => ({
					data: null,
					error: error instanceof Error ? error : new Error("Unknown error"),
				}));

		method.query = (queryOptions = {}, clientOptions = {}) => {
			const state = new ApiQueryResource(appState, path, { ...options, ...clientOptions }, queryOptions);
			if (queryOptions.autoStart !== false) {
				state.loading = true;
				void state.scheduleStart().catch(() => null);
			}
			return state;
		};

		method.form = (formOptions = {}, clientOptions = {}) =>
			new ApiState(appState, path, { ...options, ...clientOptions }, formOptions);

		return new Proxy(method, {
			get(_target, prop) {
				if (prop === "then") return undefined;
				if (prop === "safe") return method.safe;
				if (prop === "query") return method.query;
				if (prop === "form") return method.form;
				return makeNode([...path, String(prop)]);
			},
			apply(_target, _thisArg, args) {
				return (method as any)(args[0]);
			},
		});
	};

	return makeNode([]) as ClientFromRouter<T>;
}

export class ApiState<I = unknown, O = unknown> {
	private inputState = $state<ApiInputValue<I>>({} as ApiInputValue<I>);
	data = $state<O | null>(null);
	error = $state<Error | null>(null);
	loading = $state(false);
	depends = $state<string[]>([]);
	promise: Promise<O | null> | null = null;
	private destroyed = false;
	private defaultInput = {} as ApiInputValue<I>;
	private readonly invalidateRefresh = () => this.callSelf();

	get input() {
		return this.inputState;
	}

	set input(value: ApiInputValue<I>) {
		const nextValue = (value ?? {}) as ApiInputValue<I>;
		this.defaultInput = nextValue;
		this.inputState = nextValue;
	}

	constructor(
		private appState: AppState<Record<string, unknown>>,
		private path: string[],
		private clientOptions: ApiClientOptions = {},
		private options: ApiQueryOptions<I, O> | ApiFormOptions<I, O> = {},
	) {
		this.input = (options.input ?? {}) as ApiInputValue<I>;
		bindStateLifetime(this);
	}

	protected callSelf() {
		return (this.call as any).call(this) as Promise<O | null>;
	}

	async call(...args: I extends void ? [] | [undefined] : [ApiInputValue<I>?]) {
		if (this.destroyed) return null;
		if (this.loading && this.promise) return this.promise;

		this.promise = (async () => {
			this.loading = true;
			this.error = null;
			const input = args[0];
			const payload = Object.keys(this.input as Record<string, unknown>).length || input
				? Object.assign({}, this.input, input)
				: undefined;

			try {
				const response = await callRpc<I, O>(this.appState, this.path, payload as I, this.clientOptions);
				if ("error" in response) {
					const error = toClientError(response.error);
					await emitMessage(this.clientOptions, error.message, "error");
					throw error;
				}
				if (this.destroyed) return null;

				const data = response.data;
				this.data = data as O;
				await this.options.onResponse?.(data as O);
				await emitMessage(this.clientOptions, (data as UiPayload)?.message, "success");
				if (this.destroyed) return null;

				this.input = payload as ApiInputValue<I>;
				this.appState.unregisterRpc(this.depends, this.invalidateRefresh);
				this.depends = response.invalidate?.depends ?? [];

				if (this instanceof ApiQueryResource) {
					this.appState.registerRpc(this.depends, this.invalidateRefresh);
				} else if (response.invalidate) {
					await this.appState.invalidate(response.invalidate);
				}

				if ("resetOnSuccess" in this.options && this.options.resetOnSuccess) {
					this.input = (this.options.input ?? {}) as ApiInputValue<I>;
				}

				const ui = this.data as UiPayload;
				if (ui?.navigate) {
					if (this.clientOptions.onNavigate) {
						await this.clientOptions.onNavigate(ui.navigate);
					} else {
						await goto(ui.navigate);
					}
				}

				return this.data;
			} catch (error) {
				this.error = error instanceof Error ? error : new Error(String(error));
				throw this.error;
			} finally {
				this.loading = false;
			}
		})();

		return this.promise;
	}

	destroy() {
		if (this.destroyed) return;
		this.destroyed = true;
		this.appState.unregisterRpc(this.depends, this.invalidateRefresh);
		this.depends = [];
	}
}

class ApiQueryResource<I = unknown, O = unknown>
	extends ApiState<I, O>
	implements ApiQueryState<I, O> {
	private startPromise: Promise<O | null> | null = null;

	scheduleStart() {
		if (this.startPromise) return this.startPromise;
		this.startPromise = Promise.resolve().then(() => this.callSelf());
		return this.startPromise;
	}

	private async resolveResource() {
		await this.scheduleStart();
		if (this.error) throw this.error;
		return this.getResource();
	}

	private getResource(): ApiStateShape<I, O> {
		const self = this;
		return {
			get input() {
				return self.input;
			},
			get data() {
				return self.data;
			},
			get error() {
				return self.error;
			},
			get loading() {
				return self.loading;
			},
			get depends() {
				return self.depends;
			},
			call: (...args) => (self.call as any)(...args),
			destroy: () => self.destroy(),
		} as ApiStateShape<I, O>;
	}

	then<TResult1 = ApiStateShape<I, O>, TResult2 = never>(
		onfulfilled?: ((value: ApiStateShape<I, O>) => TResult1 | PromiseLike<TResult1>) | null,
		onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null,
	) {
		return this.resolveResource().then(onfulfilled, onrejected);
	}

	catch<TResult = never>(
		onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | null,
	) {
		return this.resolveResource().catch(onrejected);
	}

	finally(onfinally?: (() => void) | null) {
		return this.resolveResource().finally(onfinally);
	}
}
