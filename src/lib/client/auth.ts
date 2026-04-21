import { createAuthClient } from "better-auth/client";
import type { BetterAuthClientOptions } from "better-auth/client";
import { AUTH_BASE_PATH } from "../shared/constants.js";

/**
 * Create a `better-auth` browser client.
 *
 * @example
 * ```ts
 * // frontend/src/lib/auth.ts
 * import { createAuth } from "@logoutrd/app-kit/client/auth";
 * import { phoneNumberClient } from "better-auth/client/plugins";
 * import { invalidateAll } from "$app/navigation";
 *
	 * export const auth = createAuth({
	 *   plugins: [phoneNumberClient()],
	 *   onLogout: () => invalidateAll(),
	 * });
	 *
	 * // Then in your component:
	 * auth.signIn.email(...)
	 * auth.logout()
	 * ```
	 */
export function createAuth(opts: {
	basePath?: string;
	baseURL?: string;
	plugins?: unknown[];
	/** Called after sign-out completes. Use for navigation/state clearing. */
	onLogout?: () => void | Promise<void>;
	/** Called after session is force-refreshed. */
	onSessionRefreshed?: () => void | Promise<void>;
}) {
	const client = createAuthClient({
		basePath: opts.basePath ?? AUTH_BASE_PATH,
		baseURL: opts.baseURL,
		plugins: opts.plugins as BetterAuthClientOptions["plugins"],
	} satisfies BetterAuthClientOptions);

	async function logout() {
		await client.signOut().catch(() => {});
		await opts.onLogout?.();
	}

	async function invalidate() {
		await client.getSession({ query: { disableCookieCache: "true" } });
		await opts.onSessionRefreshed?.();
	}

	return Object.assign(client, {
		logout,
		invalidate,
	});
}
