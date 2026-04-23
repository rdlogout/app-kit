import { AsyncLocalStorage } from "node:async_hooks";
import type { BaseEnv } from "../env.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Per-request context carried through AsyncLocalStorage.
 *
 * Works like a Hono context — `get`/`set` for typed per-request data storage,
 * `req` for the raw Request, `waitUntil` for background tasks.
 * Fully framework-agnostic — no Hono, no SvelteKit dependency required.
 */
export type AppContext<TEnv extends BaseEnv = BaseEnv> = {
	/** Cloudflare / Worker environment bindings. */
	env: TEnv;
	/** Original HTTP request (when available). */
	req: Request | undefined;
	/** IANA timezone from Cloudflare cf object. */
	timeZone: string | undefined;
	/** Schedule a background promise after the response is sent. */
	waitUntil: (promise: Promise<unknown>) => void;
	/**
	 * Retrieve a typed value stored in the request data bag.
	 * Returns `undefined` when the key has not been set.
	 */
	get<T>(key: string): T | undefined;
	/**
	 * Store a typed value in the request data bag.
	 * Use this to pass data between middleware and handlers (e.g. user, session).
	 */
	set<T>(key: string, value: T): void;
};

export type RunContextArgs<TEnv extends BaseEnv> = {
	env: TEnv;
	req?: Request;
	waitUntil?: (promise: Promise<unknown>) => void;
	/** Fallback when `waitUntil` is not passed directly. */
	executionCtx?: { waitUntil: (promise: Promise<unknown>) => void };
	cf?: { timezone?: string };
};

// ---------------------------------------------------------------------------
// Internal — mutable impl behind the public AppContext interface
// ---------------------------------------------------------------------------

class RequestContext<TEnv extends BaseEnv> implements AppContext<TEnv> {
	env: TEnv;
	req: Request | undefined;
	timeZone: string | undefined;
	private _waitUntil: ((promise: Promise<unknown>) => void) | undefined;
	private readonly _data = new Map<string, unknown>();

	constructor(args: RunContextArgs<TEnv>) {
		this.env = args.env;
		this.req = args.req;
		this.timeZone = args.cf?.timezone;
		this._waitUntil = args.waitUntil ?? args.executionCtx?.waitUntil.bind(args.executionCtx);
	}

	waitUntil(promise: Promise<unknown>): void {
		if (this._waitUntil) {
			this._waitUntil(promise);
		} else {
			promise.catch((err) => console.error("[app-kit] Background task error:", err));
		}
	}

	get<T>(key: string): T | undefined {
		return this._data.get(key) as T | undefined;
	}

	set<T>(key: string, value: T): void {
		this._data.set(key, value);
	}

	/** Apply updates from a new wrapContext call (nested / middleware). */
	update(args: RunContextArgs<TEnv>): void {
		this.env = args.env;
		if (args.req) this.req = args.req;
		if (args.cf?.timezone) this.timeZone = args.cf.timezone;
		const wu = args.waitUntil ?? args.executionCtx?.waitUntil.bind(args.executionCtx);
		if (wu) this._waitUntil = wu;
	}
}

// ---------------------------------------------------------------------------
// Internal storage — one per worker process, shared across all requests
// ---------------------------------------------------------------------------

const storage = new AsyncLocalStorage<RequestContext<BaseEnv>>();

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Retrieve the current request context.
 * Throws if called outside a `wrapContext` / `runDOContext` scope.
 */
export function getContext<TEnv extends BaseEnv = BaseEnv>(): AppContext<TEnv> {
	const ctx = storage.getStore();
	if (!ctx) throw new Error("[app-kit] No context found. Wrap your handler in wrapContext().");
	return ctx as unknown as AppContext<TEnv>;
}

/**
 * Try to get the context without throwing.
 * Returns `undefined` when called outside a context scope.
 */
export function tryGetContext<TEnv extends BaseEnv = BaseEnv>(): AppContext<TEnv> | undefined {
	return storage.getStore() as unknown as AppContext<TEnv> | undefined;
}

/**
 * Schedule a background promise. Falls back to fire-and-forget if no
 * `waitUntil` was provided to `wrapContext`.
 */
export function waitUntil(promise: Promise<unknown>): void {
	const ctx = storage.getStore();
	if (ctx) {
		ctx.waitUntil(promise);
	} else {
		promise.catch((err) => console.error("[app-kit] waitUntil called outside context:", err));
	}
}

/**
 * Run `next` inside a request context.
 *
 * The context exposes `env`, `req`, `get`/`set` (request-scoped data bag),
 * `waitUntil`, and `timeZone` — usable from any function in the call stack
 * without prop-drilling.
 *
 * @example
 * ```ts
 * // Cloudflare Worker entry
 * export default {
 *   fetch: (req, env, ctx) =>
 *     wrapContext(() => app.fetch(req, env, ctx), {
 *       env,
 *       req,
 *       waitUntil: ctx.waitUntil.bind(ctx),
 *     }),
 * };
 * ```
 */
export function wrapContext<TEnv extends BaseEnv, T>(
	next: (ctx: AppContext<TEnv>) => T | Promise<T>,
	args: RunContextArgs<TEnv>,
): Promise<T> {
	const existing = storage.getStore() as RequestContext<TEnv> | undefined;

	// Already inside a context: merge new args in-place, then call next.
	if (existing) {
		existing.update(args);
		return Promise.resolve(next(existing as unknown as AppContext<TEnv>));
	}

	const ctx = new RequestContext(args);
	return storage.run(
		ctx as unknown as RequestContext<BaseEnv>,
		() => Promise.resolve(next(ctx as unknown as AppContext<TEnv>)),
	);
}

/**
 * Convenience wrapper for Durable Object handlers.
 * Pulls `env` and `waitUntil` from the DO instance.
 *
 * @example
 * ```ts
 * async onMessage(conn, msg) {
 *   await runDOContext(() => handleMessage(conn, msg), this);
 * }
 * ```
 */
export function runDOContext<TEnv extends BaseEnv, T>(
	next: () => T | Promise<T>,
	doInstance: { env: TEnv; ctx: { waitUntil: (promise: Promise<unknown>) => void } },
): Promise<T> {
	return wrapContext(() => next(), {
		env: doInstance.env,
		waitUntil: doInstance.ctx.waitUntil.bind(doInstance.ctx),
	});
}
