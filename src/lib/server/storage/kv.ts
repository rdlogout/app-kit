/**
 * Minimal KV store interface backed by Cloudflare KV.
 */
export type KVStore = {
	get: (key: string) => Promise<string | null>;
	set: (key: string, value: string, ttlSeconds?: number) => Promise<void>;
	delete: (key: string) => Promise<void>;
	getJson: <T>(key: string) => Promise<T | null>;
	setJson: <T>(key: string, value: T, ttlSeconds?: number) => Promise<void>;
};

/**
 * Create a typed KV store wrapper from a raw KVNamespace binding.
 *
 * @example
 * ```ts
 * import { createKV } from "@logoutrd/app-kit/server/storage";
 * import { getContext } from "@logoutrd/app-kit/server/context";
 *
 * export const kv = createKV(() => getContext<Env>().env.KV);
 * ```
 */
export function createKV(getKV: () => KVNamespace): KVStore {
	return {
		async get(key) {
			return getKV().get(key);
		},

		async set(key, value, ttlSeconds) {
			await getKV().put(key, value, ttlSeconds ? { expirationTtl: ttlSeconds } : undefined);
		},

		async delete(key) {
			await getKV().delete(key);
		},

		async getJson<T>(key: string): Promise<T | null> {
			const raw = await getKV().get(key);
			if (!raw) return null;
			try {
				return JSON.parse(raw) as T;
			} catch {
				return null;
			}
		},

		async setJson<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
			await getKV().put(
				key,
				JSON.stringify(value),
				ttlSeconds ? { expirationTtl: ttlSeconds } : undefined,
			);
		},
	};
}
