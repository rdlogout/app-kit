import type { ApiState } from "./client.svelte.js";
import type { SafeResult } from "../../shared/utils/wrapper.js";

type ApiCall<I, O> = [I] extends [void]
	? (() => Promise<O>)
	: undefined extends I
		? ((input?: I) => Promise<O>)
		: ((input: I) => Promise<O>);

export type RpcProcedure = { _rpc: true; handler: (input: any, c: any) => any };
export type RpcRouter = { [key: string]: RpcRouter | RpcProcedure };
export type RpcResponse<T> =
	| { data: T; invalidate?: ClientInvalidationPayload }
	| { error: { message: string; status: number }; invalidate?: ClientInvalidationPayload };
export type ApiInputValue<T> = T extends object ? Partial<T> : T;
export type ApiFormValue<T> = T extends object ? Partial<T> : T;

export type ClientInvalidationPayload = {
	depends?: string[];
	auth?: boolean;
	all?: boolean;
};

export type ApiClientOptions = {
	baseUrl?: string;
	headers?: HeadersInit | (() => HeadersInit);
	fetch?: typeof fetch;
	getRequestEvent?: () => Promise<{ fetch: typeof fetch; locals: Record<string, unknown> }>;
	hydrationCache?: Record<string, RpcResponse<unknown>>;
	ssrStoreKey?: string;
	onNavigate?: (to: string) => void | Promise<void>;
	onMessage?: (message: string, type: "success" | "error") => void | Promise<void>;
};

export type ApiQueryOptions<I, O> = {
	input?: ApiInputValue<I>;
	onResponse?: (data: O) => void | Promise<void>;
	autoStart?: boolean;
};

export type ApiFormOptions<I, O> = {
	input?: ApiFormValue<I>;
	onResponse?: (data: O) => void | Promise<void>;
	resetOnSuccess?: boolean;
};

export type ApiStateShape<I, O> = {
	input: ApiInputValue<I>;
	data: O | null;
	error: Error | null;
	loading: boolean;
	depends: string[];
	call: (...args: I extends void ? [] | [undefined] : [ApiInputValue<I>?]) => Promise<O | null>;
	destroy: () => void;
};

export type ApiQueryState<I, O> = ApiStateShape<I, O> & PromiseLike<ApiStateShape<I, O>>;

export type ApiClientMethod<I, O> = ApiCall<I, O> & {
	safe: ApiCall<I, SafeResult<O>>;
	query: (options?: ApiQueryOptions<I, O>, clientOptions?: ApiClientOptions) => ApiQueryState<I, O>;
	form: (options?: ApiFormOptions<I, O>, clientOptions?: ApiClientOptions) => ApiState<I, O>;
};

export type ClientFromRouter<T extends RpcRouter> = {
	[K in keyof T]: T[K] extends RpcProcedure
		? ApiClientMethod<Parameters<T[K]["handler"]>[0], Awaited<ReturnType<T[K]["handler"]>>>
		: T[K] extends RpcRouter
			? ClientFromRouter<T[K]>
			: never;
};
