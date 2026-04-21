# @logoutrd/app-kit

Reusable SvelteKit app primitives for backend, frontend, and UI.

This package is scaffolded as a Svelte package using `@sveltejs/package`, with all public library code living under `src/lib` and package output generated into `dist`.

## Usage Docs

- `docs/usage/overview.md`
- `docs/usage/context.md`
- `docs/usage/auth.md`
- `docs/usage/rpc-server.md`
- `docs/usage/rpc-client.md`
- `docs/usage/app-state.md`

These docs describe the intended public usage contract. Prefer following them over file-level comments while the package is still evolving.

## Quickstart

Server RPC:

```ts
import { z } from "zod";
import { rpcFn, createRpcRouter, createRpcHandler } from "@logoutrd/app-kit/server/rpc";

const userRpc = createRpcRouter({
	get: rpcFn({
		input: z.object({ id: z.string() }),
		handler: async ({ id }) => ({ id }),
		depends: ({ id }) => [`user:${id}`],
	}),
});

export const appRouter = createRpcRouter({ user: userRpc });
export type AppRouter = typeof appRouter;

app.post("/api/rpc/*", createRpcHandler(appRouter));
```

Client API:

```ts
import { createApi } from "@logoutrd/app-kit/client/api";
import { createAppState } from "@logoutrd/app-kit/client/state";

export const appState = createAppState({});
export const api = createApi<AppRouter>(appState, {
	onMessage: (message, type) => console.log(type, message),
});
```

```svelte
<script lang="ts">
	let { data, loading, error } = $derived(api.user.get.query({ input: { id: "1" } }));
</script>
```

Server auth:

```ts
import { createAuth } from "@logoutrd/app-kit/server/auth";

export const getAuth = createAuth({
	database,
});

const auth = getAuth();
const { user, session } = await auth.getSession();
```

## Development

```sh
pnpm install
pnpm dev
```

## Package

```sh
pnpm package
pnpm check
```

You can inspect the publishable tarball locally with:

```sh
npm pack
```

## Publish

This package is configured as a scoped public npm package.

```sh
npm login
npm publish --access public
```

## Notes

- Public package source lives in `src/lib`
- Built package output lives in `dist`
- `prepublishOnly` runs packaging, publint, and type checks before publish
