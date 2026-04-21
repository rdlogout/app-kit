import { betterAuth } from "better-auth";
import { getContext, tryGetContext } from "../context/runtime.js";
import { queueSetCookie, readSetCookieHeaders } from "../context/internal.js";
import { safeWrapper } from "../../shared/utils/wrapper.js";
import { AUTH_BASE_PATH } from "../../shared/constants.js";
import type { Auth, AuthSession, AuthUser, CreateAuthOptions, GetSessionOptions, SessionResult } from "./types.js";

function readEnvString(env: Record<string, unknown>, key: string, label: string): string {
	const value = env[key];
	if (typeof value === "string" && value.trim()) return value;
	throw new Error(`[app-kit/auth] Missing ${label} in env key \`${key}\`.`);
}

function resolveString(
	value: string | (() => string) | undefined,
	fallback: () => string,
): string {
	if (typeof value === "function") return value();
	if (typeof value === "string" && value.trim()) return value;
	return fallback();
}

function resolveValue<T>(value: T | (() => T) | undefined): T | undefined {
	if (typeof value === "function") return (value as () => T)();
	return value;
}

const USER_KEY = "user";
const SESSION_KEY = "session";

type AuthLike = {
	api: {
		getSession: (options: {
			headers: Headers;
			asResponse: true;
			query?: { disableCookieCache: "true" };
		}) => Promise<Response>;
	};
};

export type AuthWithSession = Auth & {
	getSession: (options?: GetSessionOptions) => Promise<SessionResult>;
};

export let getAuth: (() => AuthWithSession) | null = null;

async function fetchSession(
	auth: AuthLike,
	request: Request,
	disableCookieCache: boolean,
): Promise<SessionResult> {
	const { data: response, error } = await safeWrapper(() =>
		auth.api.getSession({
			headers: request.headers,
			asResponse: true,
			query: disableCookieCache ? { disableCookieCache: "true" } : undefined,
		}),
	);

	if (error || !response) {
		console.error("[app-kit/auth] getSession error:", error?.message);
		return { user: null, session: null };
	}

	const body = (await response.json()) as {
		user: AuthUser | null;
		session: AuthSession | null;
	} | null;

	for (const cookie of readSetCookieHeaders(response.headers)) {
		queueSetCookie(cookie);
	}

	return { user: body?.user ?? null, session: body?.session ?? null };
}

/**
 * Create a lazy `getAuth()` factory.
 *
 * The returned function reads `name`, `domain`, and `secret` from the current
 * request context env by default, caches the Better Auth instance per env
 * object, and returns it extended with session helpers:
 *
 * - `getSession()`
 * - `authRequired()`
 * - `invalidateSession()`
 *
 * @example
 * ```ts
 * // backend/src/lib/auth.ts
 * import { createAuth } from "@logoutrd/app-kit/server/auth";
 * import { drizzleAdapter } from "better-auth/adapters/drizzle";
 * import { db } from "$lib/db";
 * import * as schema from "$lib/db/schema";
 *
 * export const getAuth = createAuth({
 *   database: drizzleAdapter(db, { provider: "pg", schema }),
 * });
 *
 * export type AppAuth = ReturnType<typeof getAuth>;
 * ```
 */
export function createAuth(options: CreateAuthOptions) {
	const envKeys = {
		appName: options.envKeys?.appName ?? "name",
		baseUrl: options.envKeys?.baseUrl ?? "domain",
		secret: options.envKeys?.secret ?? "secret",
	};

	const cache = new WeakMap<object, AuthWithSession>();

	const authGetter = function () {
		const { env } = getContext();
		const envRef = env as object;
		const cached = cache.get(envRef);
		if (cached) return cached;

		const appName = resolveString(options.appName, () =>
			readEnvString(env, envKeys.appName, "app name"),
		);
		const baseUrl = resolveString(options.baseUrl, () =>
			readEnvString(env, envKeys.baseUrl, "base url"),
		);
		const secret = resolveString(options.secret, () =>
			readEnvString(env, envKeys.secret, "auth secret"),
		);

		const auth = betterAuth({
			database: options.database,
			baseURL: baseUrl,
			basePath: options.basePath ?? AUTH_BASE_PATH,
			appName,
			secret,
			trustedOrigins: resolveValue(options.trustedOrigins),
			advanced: {
				cookiePrefix: options.cookiePrefix ?? "_auth_",
			},
			socialProviders: resolveValue(options.socialProviders),
			emailAndPassword: { enabled: false },
			session: {
				expiresIn: options.sessionExpiresIn ?? 60 * 60 * 24 * 7,
				updateAge: options.sessionUpdateAge ?? 60 * 60 * 24,
				additionalFields: options.additionalSessionFields,
				cookieCache: {
					enabled: true,
					maxAge: 5 * 60,
				},
			},
			user: {
				additionalFields: options.additionalUserFields,
			},
			databaseHooks: options.databaseHooks,
			hooks: options.hooks,
			plugins: options.plugins,
		});

		const withHelpers = Object.assign(auth, {
			async getSession(sessionOptions?: GetSessionOptions): Promise<SessionResult> {
				const ctx = tryGetContext();

				if (!sessionOptions?.disableCookieCache && ctx) {
					const cachedUser = ctx.get<AuthUser | null>(USER_KEY);
					const cachedSession = ctx.get<AuthSession | null>(SESSION_KEY);
					if (cachedUser !== undefined && cachedSession !== undefined) {
						return { user: cachedUser, session: cachedSession };
					}
				}

				const request = ctx?.req;
				if (!request) return { user: null, session: null };

				const result = await fetchSession(auth, request, sessionOptions?.disableCookieCache ?? false);

				if (ctx) {
					ctx.set(USER_KEY, result.user);
					ctx.set(SESSION_KEY, result.session);
				}

				return result;
			},
		}) as unknown as AuthWithSession;

		cache.set(envRef, withHelpers);
		return withHelpers;
	};

	getAuth = authGetter;
	return authGetter;
}
