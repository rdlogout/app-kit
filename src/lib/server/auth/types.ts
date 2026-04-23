import type { betterAuth, BetterAuthOptions } from "better-auth";

/** Return type of betterAuth() — what createAuth returns. */
export type Auth = ReturnType<typeof betterAuth>;

// ---------------------------------------------------------------------------
// Session result shapes
// ---------------------------------------------------------------------------

/** Generic user shape from better-auth sessions. Projects can extend via module augmentation. */
export type AuthUser = { id: string; email: string; name: string; [key: string]: unknown };
/** Generic session shape from better-auth sessions. */
export type AuthSession = { id: string; userId: string; [key: string]: unknown };

export type SessionResult = {
	user: AuthUser | null;
	session: AuthSession | null;
};

export type GetSessionOptions = {
	/** By-pass the Hono context cookie cache and re-fetch from auth. */
	disableCookieCache?: boolean;
};

// ---------------------------------------------------------------------------
// createAuth options
// ---------------------------------------------------------------------------

/**
 * Options passed to `createAuth`. All app-specific config lives here —
 * the package never assumes any fixed plugins or social providers.
 */
export type CreateAuthOptions = {
	/** Drizzle adapter already configured by the project. */
	database: BetterAuthOptions["database"];
	/** better-auth social providers config. */
	socialProviders?: BetterAuthOptions["socialProviders"];
	/** better-auth plugins array (phoneNumber, organization, magicLink…). */
	plugins?: readonly unknown[];
	/** Drizzle-level hooks (e.g. beforeCreate user). */
	databaseHooks?: BetterAuthOptions["databaseHooks"];
	/** Extra fields to add to the session. */
	additionalSessionFields?: NonNullable<
		NonNullable<BetterAuthOptions["session"]>["additionalFields"]
	>;
	/** Extra fields to add to the user. */
	additionalUserFields?: NonNullable<
		NonNullable<BetterAuthOptions["user"]>["additionalFields"]
	>;
	/** better-auth middleware hooks (before/after). */
	hooks?: BetterAuthOptions["hooks"];
	/** Cookie name prefix. Defaults to "_auth_". */
	cookiePrefix?: string;
	/** Base path for auth API. Defaults to "/api/auth". */
	basePath?: string;
	/** Session expiry in seconds. Defaults to 7 days. */
	sessionExpiresIn?: number;
	/** Session update window in seconds. Defaults to 1 day. */
	sessionUpdateAge?: number;
};

export type CreateAuthInput = CreateAuthOptions | (() => CreateAuthOptions);
