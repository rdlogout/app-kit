import { createKV } from "./kv.js";

export type CacheStore = {
	getResponse: (key: string) => Promise<Response | null>;
	setResponse: (key: string, response: Response, waitUntil?: (p: Promise<unknown>) => void) => Promise<void>;
	getJson: <T>(key: string) => Promise<T | null>;
	setJson: <T>(key: string, data: T, ttlSeconds?: number, waitUntil?: (p: Promise<unknown>) => void) => Promise<void>;
};

type CreateCacheOptions = {
	getKV: () => KVNamespace;
	/** Full domain or base URL used to normalise relative cache keys (e.g. "https://example.com"). */
	getDomain: () => string;
};

function normaliseCacheKey(key: string, domain: string): string {
	if (key.startsWith("http")) return key;
	try {
		return new URL(key, domain).toString();
	} catch {
		return key;
	}
}

/**
 * Create a two-layer cache: Cloudflare Cache API (fast, edge-local) backed
 * by KV (durable, global).
 *
 * @example
 * ```ts
 * import { createCache } from "@logoutrd/app-kit/server/storage";
 * import { getContext } from "@logoutrd/app-kit/server/context";
 *
 * export const cache = createCache({
 *   getKV: () => getContext<Env>().env.KV,
 *   getDomain: () => "https://myapp.com",
 * });
 * ```
 */
export function createCache(options: CreateCacheOptions): CacheStore {
	const { getKV, getDomain } = options;
	const kv = createKV(getKV);

	function cacheKey(key: string) {
		return normaliseCacheKey(key, getDomain());
	}

	// Cloudflare's Cache API — typed through the global `caches` object.
	function getCacheApi(): Cache {
		return (caches as unknown as { default: Cache }).default;
	}

	return {
		async getResponse(key) {
			const cacheData = await getCacheApi().match(cacheKey(key));
			if (!cacheData) return null;
			const headers = new Headers(cacheData.headers);
			headers.set("X-Cache", "HIT");
			return new Response(cacheData.body, {
				headers,
				status: cacheData.status,
				statusText: cacheData.statusText,
			});
		},

		async setResponse(key, response, waitUntil) {
			const put = getCacheApi().put(cacheKey(key), response.clone());
			if (waitUntil) waitUntil(put);
			else await put;
		},

		async getJson<T>(key: string): Promise<T | null> {
			const cached = await getCacheApi().match(cacheKey(key));
			if (cached) return (await cached.json()) as T;
			return kv.getJson<T>(cacheKey(key));
		},

		async setJson<T>(key: string, data: T, ttlSeconds?: number, waitUntil?: (p: Promise<unknown>) => void) {
			const headers: Record<string, string> = { "Content-Type": "application/json" };
			if (ttlSeconds && ttlSeconds > 0) {
				headers["Cache-Control"] = `public, max-age=${ttlSeconds}`;
			}
			const response = new Response(JSON.stringify(data), { headers });
			await this.setResponse(key, response, waitUntil);
			const kvSet = kv.setJson(cacheKey(key), data, ttlSeconds);
			if (waitUntil) waitUntil(kvSet);
			else await kvSet;
		},
	};
}
