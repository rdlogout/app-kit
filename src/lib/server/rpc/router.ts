import type { RpcProcedure, RpcRouter } from "./types.js";

export function createRpcRouter<T extends RpcRouter>(router: T): T {
	return router;
}

export function isRpcProcedure(value: unknown): value is RpcProcedure<any, any> {
	return !!value && typeof value === "object" && (value as RpcProcedure<any, any>)._rpc === true;
}

export function resolveRpcProcedure(
	router: RpcRouter,
	segments: string[],
): RpcProcedure<any, any> | null {
	let node: RpcRouter | RpcProcedure<any, any> = router;

	for (const segment of segments) {
		if (!node || typeof node !== "object" || isRpcProcedure(node)) return null;
		node = node[segment] as RpcRouter | RpcProcedure<any, any>;
	}

	return isRpcProcedure(node) ? node : null;
}
