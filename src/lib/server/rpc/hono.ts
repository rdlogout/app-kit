import type { Env, Handler } from "hono";
import { executeRpc, readRpcInput, toRpcErrorResponse } from "./execute.js";
import { resolveRpcProcedure } from "./router.js";
import type { RpcRouter } from "./types.js";

export type CreateRpcHandlerOptions = {
	prefix?: string;
};

export function createRpcHandler<TEnv extends Env = Env>(
	router: RpcRouter,
	options: CreateRpcHandlerOptions = {},
): Handler<TEnv> {
	const prefix = options.prefix ?? "/api/rpc/";

	return async (c) => {
		const path = c.req.path.startsWith(prefix)
			? c.req.path.slice(prefix.length)
			: c.req.path.replace(/^\/+/, "");
		const segments = path.split("/").filter(Boolean);
		const procedure = resolveRpcProcedure(router, segments);

		if (!procedure) {
			return c.json({ error: { message: "Not Found", status: 404 } }, 404);
		}

		try {
			const rawInput = await readRpcInput(c.req.raw);
			const result = await executeRpc(procedure, rawInput, c);
			return new Response(JSON.stringify(result), {
				status: "error" in result ? result.error.status : 200,
				headers: { "content-type": "application/json" },
			});
		} catch (error) {
			return toRpcErrorResponse(error);
		}
	};
}
