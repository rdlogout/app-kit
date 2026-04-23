import type { Context } from "hono";
import type { z } from "zod";
import type { ClientInvalidationPayload } from "../invalidate.js";

export type RpcResponse<T> =
	| { data: T; invalidate?: ClientInvalidationPayload }
	| { error: { message: string; status: number }; invalidate?: ClientInvalidationPayload };

export type InferRpcInput<T> = T extends z.ZodTypeAny ? z.infer<T> : undefined;

export type RpcDepends<Schema extends z.ZodTypeAny | undefined, Output> =
	| string
	| string[]
	| ((input: InferRpcInput<Schema>, output: Output) => string | string[] | undefined);

export type RpcFnOptions<Schema extends z.ZodTypeAny | undefined, Output> = {
	input?: Schema;
	handler: (input: InferRpcInput<Schema>, c: Context) => Output | Promise<Output>;
	depends?: RpcDepends<Schema, Output>;
};

export type RpcProcedure<I = void, O = unknown> = {
	_rpc: true;
	input?: z.ZodType<I>;
	handler: (input: I, c: Context) => O | Promise<O>;
	depends?: (input: I, output: O) => string[] | undefined;
};

export interface RpcRouter {
	[key: string]: RpcRouter | RpcProcedure<any, any>;
}
