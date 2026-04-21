# Server Auth

Server auth is lazy.

`createAuth(...)` returns `getAuth()`, not a prebuilt auth singleton.

That means auth can safely be declared at module scope and only read request context when called.

## Usage

```ts
import { createAuth } from "@logoutrd/app-kit/server/auth";

export const getAuth = createAuth({
	database,
	plugins,
});
```

Inside a request:

```ts
const auth = getAuth();
const { user, session } = await auth.getSession();
```

## What `getAuth()` returns

The Better Auth instance is extended with one helper:

- `getSession(options?)`

```ts
const auth = getAuth();
await auth.getSession();
await auth.getSession({ disableCookieCache: true });
```

## Env-backed config

By default, `getAuth()` reads these values from `getContext().env`:

- `name` -> app name
- `domain` -> base URL
- `secret` -> auth secret

You can override them directly:

```ts
export const getAuth = createAuth({
	database,
	appName: "My App",
	baseUrl: "https://example.com",
	secret: "super-secret",
});
```

Or override env key names:

```ts
export const getAuth = createAuth({
	database,
	envKeys: {
		appName: "APP_NAME",
		baseUrl: "APP_URL",
		secret: "AUTH_SECRET",
	},
});
```

## Request caching

`auth.getSession()` caches `user` and `session` in request context for the current request lifetime.

Use `disableCookieCache: true` to force a fresh session read.

## Important Rule

`createAuth(...)` is safe at module scope.

`getAuth()` must run inside a real request context because it reads `getContext().env`.
