import type { Handle, RequestEvent } from "@sveltejs/kit";
import { AUTH_GET_SESSION_PATH, DEFAULT_RPC_STORE_KEY } from "../../shared/constants.js";
import { readSetCookieHeaders } from "../context/internal.js";
import type { CreateHandleOptions } from "./types.js";

const DEFAULT_PROXY_PATHS = ["/api", "/assets"];
const nativeFetch = globalThis.fetch.bind(globalThis);

type BackendFetch = (request: Request) => Promise<Response>;

type RequestInitWithDuplex = RequestInit & {
	duplex?: "half";
};

type CookieOptions = Parameters<RequestEvent["cookies"]["set"]>[2];

type ParsedCookie = {
	name: string;
	value: string;
	options: CookieOptions;
};

function serializeRpcCache(data: Record<string, unknown>) {
	return JSON.stringify(data)
		.replace(/</g, "\\u003c")
		.replace(/>/g, "\\u003e")
		.replace(/&/g, "\\u0026")
		.replace(/\u2028/g, "\\u2028")
		.replace(/\u2029/g, "\\u2029");
}

function shouldProxy(pathname: string, paths: string[]): boolean {
	return paths.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

function toProxyInit(request: Request): RequestInitWithDuplex {
	const init: RequestInitWithDuplex = {
		method: request.method,
		headers: new Headers(request.headers),
	};

	if (request.method !== "GET" && request.method !== "HEAD") {
		init.body = request.body;
		init.duplex = "half";
	}

	return init;
}

function cloneResponse(response: Response): Response {
	const headers = new Headers();
	response.headers.forEach((value, key) => {
		if (key.toLowerCase() !== "set-cookie") headers.set(key, value);
	});

	for (const cookie of readSetCookieHeaders(response.headers)) {
		headers.append("set-cookie", cookie);
	}

	return new Response(response.body, {
		status: response.status,
		statusText: response.statusText,
		headers,
	});
}

function parseSetCookie(cookie: string): ParsedCookie | null {
	const [rawNameValue, ...rawAttributes] = cookie.split(";");
	const separatorIndex = rawNameValue.indexOf("=");
	if (separatorIndex <= 0) return null;

	const name = rawNameValue.slice(0, separatorIndex).trim();
	if (!name) return null;

	const value = rawNameValue.slice(separatorIndex + 1);
	const options = { path: "/" } as CookieOptions;

	for (const attribute of rawAttributes) {
		const trimmed = attribute.trim();
		if (!trimmed) continue;

		const equalsIndex = trimmed.indexOf("=");
		const key = (equalsIndex === -1 ? trimmed : trimmed.slice(0, equalsIndex)).trim().toLowerCase();
		const rawValue = equalsIndex === -1 ? "" : trimmed.slice(equalsIndex + 1).trim();

		if (key === "secure") options.secure = true;
		else if (key === "httponly") options.httpOnly = true;
		else if (key === "path" && rawValue) options.path = rawValue;
		else if (key === "domain" && rawValue) options.domain = rawValue;
		else if (key === "max-age") {
			const maxAge = Number.parseInt(rawValue, 10);
			if (!Number.isNaN(maxAge)) options.maxAge = maxAge;
		} else if (key === "expires") {
			const expires = new Date(rawValue);
			if (!Number.isNaN(expires.getTime())) options.expires = expires;
		} else if (key === "samesite") {
			const sameSite = rawValue.toLowerCase();
			if (sameSite === "lax" || sameSite === "strict" || sameSite === "none") {
				options.sameSite = sameSite;
			}
		}
	}

	return { name, value, options };
}

function applyResponseCookies(event: RequestEvent, response: Response): void {
	for (const cookie of readSetCookieHeaders(response.headers)) {
		const parsed = parseSetCookie(cookie);
		if (!parsed) continue;
		event.cookies.set(parsed.name, parsed.value, parsed.options);
	}
}

function resolveBackend(event: RequestEvent, options: CreateHandleOptions): {
	fetch: BackendFetch;
	url: URL;
} {
	const bindingName = options.binding ?? "BACKEND";
	const originEnv = options.backendOriginEnv ?? "BACKEND_ORIGIN";
	const binding = (event.platform as { env?: Record<string, unknown> } | undefined)?.env?.[
		bindingName
	] as { fetch?: BackendFetch } | undefined;

	if (binding?.fetch) {
		return {
			fetch: binding.fetch.bind(binding),
			url: new URL(`${event.url.pathname}${event.url.search}`, event.url.origin),
		};
	}

	const origin = process.env[originEnv];
	if (origin) {
		return {
			fetch: nativeFetch,
			url: new URL(`${event.url.pathname}${event.url.search}`, origin),
		};
	}

	throw new Error(
		`[app-kit/sveltekit] Missing backend binding \`${bindingName}\` and env \`${originEnv}\`.`,
	);
}

async function proxyToBackend(event: RequestEvent, options: CreateHandleOptions): Promise<Response> {
	const backend = resolveBackend(event, options);
	const request = new Request(backend.url, toProxyInit(event.request));
	const response = await backend.fetch(request);

	if (response.status === 101 || event.request.headers.get("upgrade")?.toLowerCase() === "websocket") {
		return response;
	}

	return cloneResponse(response);
}

export function createHandle(options: CreateHandleOptions = {}): Handle {
	const proxyPaths = [...DEFAULT_PROXY_PATHS, ...(options.proxyPaths ?? []), ...(options.extraProxyPaths ?? [])];

	return async ({ event, resolve }) => {
		const rpcStoreKey = options.rpcStoreKey ?? DEFAULT_RPC_STORE_KEY;
		const locals = event.locals as Record<string, unknown>;
		locals[rpcStoreKey] = {};
		locals.user = null;
		locals.session = null;
		locals.token = null;
		locals.authDataFetched = false;

		const getAuthData = async () => {
			if (!locals.authDataFetched) {
				try {
					const authUrl = new URL(options.authPath ?? AUTH_GET_SESSION_PATH, event.request.url);
					const authEvent = {
						...event,
						url: authUrl,
						request: new Request(authUrl, {
							method: "GET",
							headers: event.request.headers,
						}),
					} as RequestEvent;
					const response = await proxyToBackend(authEvent, options);
					applyResponseCookies(event, response);
					const data = (await response.json()) as { user?: unknown; session?: unknown } | null;
					locals.user = data?.user ?? null;
					locals.session = data?.session ?? null;
				} catch (error) {
					console.error("[app-kit/sveltekit] Failed to fetch auth data:", error);
					locals.user = null;
					locals.session = null;
				}

				locals.authDataFetched = true;
			}

			return {
				user: locals.user ?? null,
				session: locals.session ?? null,
			};
		};

		if (shouldProxy(event.url.pathname, proxyPaths)) {
			return proxyToBackend(event, options);
		}

		locals.getAuthData = getAuthData;

		const wrappedResolve: typeof resolve = (eventArg, resolveOptions) => {
			if (options.injectRpc === false) return resolve(eventArg, resolveOptions);

			const previous = resolveOptions?.transformPageChunk;
			return resolve(eventArg, {
				...resolveOptions,
				transformPageChunk: async ({ html, done }) => {
					const baseHtml = previous ? await previous({ html, done }) : html;
					if (!done || !baseHtml) return baseHtml;

					const rpc = locals[rpcStoreKey] as Record<string, unknown> | undefined;
					if (!rpc || Object.keys(rpc).length === 0) return baseHtml;

					const script = `<script>window.__RPC__=${serializeRpcCache(rpc)};</script>`;
					return baseHtml.includes("</body>")
						? baseHtml.replace("</body>", `${script}</body>`)
						: `${baseHtml}${script}`;
				},
			});
		};

		return wrappedResolve(event);
	};
}
