# Context

The server context layer is request-scoped and built on `AsyncLocalStorage`.

Use it for:

- `env`
- `req`
- `waitUntil`
- per-request cached values like `user`, `session`, and invalidation payloads

Do not use it for static app config.

## Basic API

```ts
import {
	runContext,
	runDOContext,
	getContext,
	tryGetContext,
	waitUntil,
	createEnvProxy,
} from "@logoutrd/app-kit/server/context";
```

## Worker usage

Use `runWorkerFetch(...)` so Worker handlers automatically run inside context:

```ts
import { runWorkerFetch } from "@logoutrd/app-kit/server/context";

export default {
	fetch: runWorkerFetch((request, env, ctx) => {
		return app.fetch(request, env, ctx);
	}),
};
```

## SvelteKit usage

Use `runSveltekitHook(...)` so the hook runs inside context and RPC SSR hydration is injected automatically:

```ts
import { runSveltekitHook } from "@logoutrd/app-kit/server/context";

export const handle = runSveltekitHook(
	(event) => ({
		env: event.platform!.env as Env,
		req: event.request,
	}),
	async ({ event, resolve }) => {
		return resolve(event);
	},
);
```

## Accessing context later

Anything running inside `runContext(...)` can read request state lazily:

```ts
const ctx = getContext<Env>();
const req = ctx.req;
const user = ctx.get<User>("user");
```

Use `tryGetContext()` when code may run outside a request scope.

## Important Rule

`getContext()` only works inside a real request/DO context. Calling it at module load time throws.
