import type { Context } from "hono";
import { ZodError } from "zod";
import { getPendingInvalidation } from "../conduit/index.js";
import type { RpcProcedure, RpcResponse } from "./types.js";

export async function readRpcInput(request: Request): Promise<unknown> {
	const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";

	if (
		contentType.includes("multipart/form-data") ||
		contentType.includes("application/x-www-form-urlencoded")
	) {
		const formData = await request.formData();
		const input: Record<string, unknown> = {};

		formData.forEach((value, key) => {
			const current = input[key];
			if (current === undefined) input[key] = value;
			else if (Array.isArray(current)) current.push(value);
			else input[key] = [current, value];
		});

		return input;
	}

	const raw = await request.text();
	return raw.trim() ? JSON.parse(raw) : undefined;
}

export function toRpcErrorResponse(error: unknown): Response {
	let message = "Internal Server Error";
	let status = 500;

	if (error instanceof ZodError) {
		message = "Invalid input";
		status = 400;
	} else if (error instanceof Error) {
		message = error.message || message;
		status = (error as Error & { status?: number }).status ?? status;
	} else if (
		error &&
		typeof error === "object" &&
		"message" in error &&
		"status" in error &&
		typeof (error as { message?: unknown }).message === "string" &&
		typeof (error as { status?: unknown }).status === "number"
	) {
		message = (error as { message: string }).message;
		status = (error as { status: number }).status;
	}

	const invalidate = getPendingInvalidation();
	return new Response(JSON.stringify({ error: { message, status }, ...(invalidate ? { invalidate } : {}) }), {
		status,
		headers: { "content-type": "application/json" },
	});
}

export async function executeRpc<I, O>(
	procedure: RpcProcedure<I, O>,
	rawInput: unknown,
	c: Context,
): Promise<RpcResponse<O>> {
	const input = procedure.input ? await procedure.input.parseAsync(rawInput) : (undefined as I);
	const data = await procedure.handler(input, c);
	const invalidate = getPendingInvalidation() ?? (() => {
		const depends = procedure.depends?.(input, data);
		return depends?.length ? { depends } : undefined;
	})();

	return {
		data,
		...(invalidate ? { invalidate } : {}),
	};
}
