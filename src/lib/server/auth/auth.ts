import { betterAuth } from "better-auth";
import type { BetterAuthOptions } from "better-auth";
import { getContext, tryGetContext } from "../context/runtime.js";
import { createEnv } from "../env.js";
import { queueSetCookie, readSetCookieHeaders } from "../context/internal.js";
import { safeWrapper } from "../../shared/utils/wrapper.js";
import { AUTH_BASE_PATH } from "../../shared/constants.js";
import type { Auth, AuthSession, AuthUser, CreateAuthInput, CreateAuthOptions, GetSessionOptions, SessionResult } from "./types.js";

function readEnvString(env: object, key: string, label: string): string {
	const values = env as Record<string, unknown>;
	const value = values[key];
	if (typeof value === "string" && value.trim()) return value;
	throw new Error(`[app-kit/auth] Missing ${label} in env key \`${key}\`.`);
}

function normalizeOrigin(value: string): string {
	const input = value.trim();
	if (!input) return input;

	if (input.startsWith("http://") || input.startsWith("https://")) {
		return input.replace(/\/+$/, "");
	}

	return `https://${input.replace(/^\/+/, "").replace(/\/+$/, "")}`;
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
 * The returned function reads `NAME`, `DOMAIN`, `BASE_URL`, and `SECRET` from
 * the current request context env, caches the Better Auth instance per env
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
export function createAuth(input: CreateAuthInput) {
	const cache = new WeakMap<object, AuthWithSession>();
	const env = createEnv();

	const authGetter = function () {
		const envRef = getContext().env as object;
		const options = (typeof input === "function" ? input() : input) as CreateAuthOptions;
		const cached = cache.get(envRef);
		if (cached) return cached;

		const domain = normalizeOrigin(readEnvString(env, "DOMAIN", "domain"));
		const appName = readEnvString(env, "NAME", "app name");
		const baseUrl = normalizeOrigin(readEnvString(env, "BASE_URL", "base url"));
		const secret = readEnvString(env, "SECRET", "auth secret");
		const trustedOrigins = Array.from(new Set(["http://localhost:5173", normalizeOrigin(domain)]));

		const auth = betterAuth({
			database: options.database,
			baseURL: baseUrl,
			basePath: options.basePath ?? AUTH_BASE_PATH,
			appName,
			secret,
			trustedOrigins,
			advanced: {
				cookiePrefix: options.cookiePrefix ?? "_auth_",
			},
			socialProviders: options.socialProviders,
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
			plugins: options.plugins as BetterAuthOptions["plugins"],
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
