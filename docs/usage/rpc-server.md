# RPC Server

The server RPC surface is intentionally small:

- `rpcFn`
- `createRpcRouter`
- `createRpcHandler`

## Basic usage

```ts
import { z } from "zod";
import { rpcFn, createRpcRouter, createRpcHandler } from "@logoutrd/app-kit/server/rpc";

const userRpc = createRpcRouter({
	get: rpcFn({
		input: z.object({ id: z.string() }),
		handler: async ({ id }, c) => {
			return { id };
		},
		depends: ({ id }) => [`user:${id}`],
	}),
});

export const appRouter = createRpcRouter({
	user: userRpc,
});

export type AppRouter = typeof appRouter;

app.post("/api/rpc/*", createRpcHandler(appRouter));
```

## Procedure contract

`rpcFn(...)` accepts only:

- `input`
- `handler`
- `depends`

```ts
rpcFn({
	input: z.object({ id: z.string() }),
	handler: async (input, c) => {
		return { id: input.id };
	},
	depends: (input, output) => [`user:${input.id}`],
});
```

## Handler contract

- `input` is parsed by Zod before `handler` runs
- `handler` receives Hono `Context`
- return plain JSON-friendly data

Do not return `Response` from RPC handlers.

## Error behavior

- `ZodError` -> `400`
- thrown `Error & { status?: number }` -> uses that status when present
- plain `Error` -> `500`
- unknown thrown values -> `500`

Example:

```ts
const err = new Error("Unauthorized") as Error & { status: number };
err.status = 401;
throw err;
```

## Response contract

All responses use this body shape:

```ts
{ data?, error?, invalidate? }
```

Examples:

```ts
{ data: { id: "1" } }
```

```ts
{ data: { id: "1" }, invalidate: { depends: ["user:1"] } }
```

```ts
{ error: { message: "Unauthorized", status: 401 } }
```

## Invalidation

`invalidate` can come from two places:

1. `depends` on the RPC procedure
2. request-scoped invalidation written during the handler lifecycle

The client consumes `invalidate` from the response body, not from headers.
