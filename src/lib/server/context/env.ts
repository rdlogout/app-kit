/**
 * Minimal env shape every Cloudflare Worker shares.
 * Projects extend this with their own bindings and secrets.
 *
 * @example
 * ```ts
 * // your-project/src/lib/env.ts
 * import type { BaseEnv } from "@logoutrd/app-kit/server/context";
 *
 * export interface Env extends BaseEnv {
 *   STORAGE: R2Bucket;
 *   KV: KVNamespace;
 *   SECRET: string;
 * }
 * ```
 */
export interface BaseEnv {
	[key: string]: unknown;
}
