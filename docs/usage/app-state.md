# App State

`createAppState(...)` creates the minimal shared client state used by the API runtime.

## Usage

```ts
import { createAppState } from "@logoutrd/app-kit/client/state";

export const appState = createAppState({
	theme: "light" as "light" | "dark",
});
```

Base fields always included:

- `realtimeConnectionId: string | null`

## Why API needs it

`createApi(appState, ...)` uses app state for:

- tracking the current conduit connection id
- registering query invalidation listeners
- replaying invalidation on matching queries

## What invalidation does

When a response includes:

```ts
invalidate: { depends: ["user:1"] }
```

`appState.invalidate(...)` refreshes matching registered queries.

## API summary

```ts
appState.get(key)
appState.set(patch)
appState.invalidate(payload)
appState.registerRpc(depends, refresh)
appState.unregisterRpc(depends, refresh)
```
