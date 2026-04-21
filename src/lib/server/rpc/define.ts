import type { z } from "zod";
import type { InferRpcInput, RpcFnOptions, RpcProcedure } from "./types.js";

function toDistinctList(value: string | string[] | null | undefined): string[] | undefined {
	const items = [
		...new Set((Array.isArray(value) ? value : [value]).filter((item): item is string => Boolean(item))),
	];
	return items.length ? items : undefined;
}

export function rpcFn<Schema extends z.ZodTypeAny | undefined = undefined, Output = unknown>(
	options: RpcFnOptions<Schema, Output>,
): RpcProcedure<InferRpcInput<Schema>, Output> {
	return {
		_rpc: true,
		input: options.input as z.ZodType<InferRpcInput<Schema>> | undefined,
		handler: options.handler as RpcProcedure<InferRpcInput<Schema>, Output>["handler"],
		depends: options.depends
			? (input, output) =>
					toDistinctList(
						typeof options.depends === "function"
							? options.depends(input, output)
							: options.depends,
					)
			: undefined,
	};
}
