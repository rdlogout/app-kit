import { getAuth } from "../auth/auth.js";
import type { AuthSession, AuthUser } from "../auth/types.js";

type RequiredAuth = {
	user: AuthUser;
	session: AuthSession;
};

export async function authRequired(): Promise<RequiredAuth> {
	if (!getAuth) {
		const error = new Error("Auth has not been initialized. Call createAuth(...) during app startup.") as Error & {
			status: number;
		};
		error.status = 500;
		throw error;
	}

	const { user, session } = await getAuth().getSession();

	if (!user || !session) {
		const error = new Error("Unauthorized") as Error & { status: number };
		error.status = 401;
		throw error;
	}

	return { user, session };
}
