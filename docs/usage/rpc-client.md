# RPC Client

The client API is created from the server router type.

## Setup

```ts
import { createApi } from "@logoutrd/app-kit/client/api";
import { createAppState } from "@logoutrd/app-kit/client/state";
import type { AppRouter } from "backend/api";

export const appState = createAppState({});

export const api = createApi<AppRouter>(appState, {
	onNavigate: (to) => goto(to),
	onMessage: (message, type) => {
		console.log(type, message);
	},
});
```

`appState` is the first required argument.

It is used internally for:

- RPC invalidation
- realtime connection id forwarding

## Reads

```svelte
<script lang="ts">
	let { data, loading, error } = $derived(
		api.user.get.query({ input: { id: "1" } })
	);
</script>
```

## Forms / mutations

```ts
const updateUser = api.user.update.form({
	input: { id: "1" },
	resetOnSuccess: true,
});

await updateUser.call({ name: "Rahul" });
```

## Direct call

```ts
const user = await api.user.get({ id: "1" });
```

## Safe call

```ts
const result = await api.user.get.safe({ id: "1" });

if (result.error) {
	console.error(result.error.message);
}
```

## Global UX hooks

`createApi(...)` supports only 2 global UX hooks:

- `onNavigate(to)`
- `onMessage(message, type)`

```ts
createApi(appState, {
	onNavigate: (to) => goto(to),
	onMessage: (message, type) => toast[type](message),
});
```

## UI conventions

If server `data` contains these fields, the client runtime uses them automatically:

- `data.message?: string` -> `onMessage(message, "success")`
- `data.navigate?: string` -> `onNavigate(...)`
- `error.message` -> `onMessage(message, "error")`

## Invalidation contract

The client expects invalidation in the response body:

```ts
{ data, invalidate: { depends, auth, all } }
```

It does not read invalidation from response headers.

The conduit connection id is still sent in the request header automatically when present in app state.
