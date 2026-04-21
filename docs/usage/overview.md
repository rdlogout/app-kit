# Usage Overview

`@logoutrd/app-kit` is meant to expose a small, consistent public surface for repeated app architecture.

Use subpath imports as the primary contract:

- `@logoutrd/app-kit/server/rpc`
- `@logoutrd/app-kit/server/context`
- `@logoutrd/app-kit/server/auth`
- `@logoutrd/app-kit/client/api`
- `@logoutrd/app-kit/client/auth`
- `@logoutrd/app-kit/client/state`
- `@logoutrd/app-kit/client/conduit`

The root package export is convenience-only. Prefer subpaths for clarity and future stability.

## Core Principles

- Server request data lives in request context, not in static global state.
- Static app configuration is bound through factories.
- RPC is the main data transfer layer.
- Client invalidation is driven by the RPC response body, not response headers.
- `appState` is the required bridge between client RPC and invalidation/realtime state.

## Current Contracts

### Server RPC response

```ts
type RpcResponse<T> =
	| { data: T; invalidate?: { depends?: string[]; auth?: boolean; all?: boolean } }
	| { error: { message: string; status: number }; invalidate?: { depends?: string[]; auth?: boolean; all?: boolean } };
```

### Client UI conventions

When the RPC `data` includes these fields, the client runtime uses them automatically:

- `data.message?: string` -> forwarded to `onMessage(..., "success")`
- `error.message` -> forwarded to `onMessage(..., "error")`
- `data.navigate?: string` -> forwarded to `onNavigate(...)`

### Invalidation

- Client sends the conduit connection id in the request header:
  - `x-conduit-connection-id`
- Server returns invalidation in the JSON body under `invalidate`
- Query states subscribe using `invalidate.depends`

## Recommended Reading Order

1. `context.md`
2. `auth.md`
3. `rpc-server.md`
4. `rpc-client.md`
5. `app-state.md`
