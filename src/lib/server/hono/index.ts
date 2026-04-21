import type { Env, MiddlewareHandler } from "hono";
import type { BaseEnv } from "../context/env.js";
import { runContext } from "../context/runtime.js";
import { consumeSetCookies, setHonoContext } from "../context/internal.js";

type CloudflareRequest = Request & { cf?: { timezone?: string } };

export function useContext<TEnv extends Env = { Bindings: BaseEnv }>(): MiddlewareHandler<TEnv> {
	return async (c, next) =>
		runContext(
			async () => {
				setHonoContext(c);
				await next();

				for (const cookie of consumeSetCookies()) {
					c.res.headers.append("set-cookie", cookie);
				}
			},
			{
				env: ((c.env ?? {}) as TEnv["Bindings"]) as BaseEnv,
				req: c.req.raw,
				waitUntil: c.executionCtx?.waitUntil.bind(c.executionCtx),
				cf: (c.req.raw as CloudflareRequest).cf,
			},
		);
}
