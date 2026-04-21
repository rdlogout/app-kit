import type { Connection } from "partyserver";
import type { AuthUser } from "../auth/types.js";
import { getAuth } from "../auth/auth.js";
import { getContext, tryGetContext } from "../context/runtime.js";
import { ConduitDO } from "./conduit-do.js";
import { createConduitRoute } from "./route.js";

type ConduitTarget = {
	fetch: (request: Request) => Promise<Response>;
	send: (
		key: string,
		data: unknown,
		opts?: { target?: "all" | "except-current" | "specific"; connectionId?: string },
	) => void | Promise<void>;
};

export type ClientInvalidationPayload = {
	depends?: string[];
	auth?: boolean;
	all?: boolean;
};

export type InvalidateInput = {
	depends?: string | string[] | null;
	auth?: boolean;
	all?: boolean;
	userId?: string;
};

export type ConduitOptions = {
	getDO: (userId: string) => Promise<ConduitTarget>;
	onMessage?: Record<string, (data: unknown, conn: Connection) => unknown>;
};

const PENDING_INVALIDATION_KEY = "__app_kit_invalidate";
const CONNECTION_HEADER = "x-conduit-connection-id";

let getConduit: ((userId: string) => Promise<ConduitTarget>) | null = null;

function toDistinctList(value: string | string[] | null | undefined): string[] {
	return [
		...new Set(
			(Array.isArray(value) ? value : [value])
				.flatMap((item) => item?.split(",") ?? [])
				.map((item) => item.trim())
				.filter(Boolean),
		),
	];
}

function normalizePayload(input: Omit<InvalidateInput, "userId">): ClientInvalidationPayload | null {
	const depends = toDistinctList(input.depends);
	const auth = input.auth === undefined ? undefined : Boolean(input.auth);
	const all = input.all === undefined ? undefined : Boolean(input.all);

	if (!depends.length && auth === undefined && all === undefined) return null;

	return {
		depends: depends.length ? depends : undefined,
		auth,
		all,
	};
}

function mergePayloads(
	current: ClientInvalidationPayload,
	next: ClientInvalidationPayload,
): ClientInvalidationPayload {
	const depends = toDistinctList([...(current.depends ?? []), ...(next.depends ?? [])]);
	return {
		depends: depends.length ? depends : undefined,
		auth: next.auth !== undefined ? next.auth : current.auth,
		all: next.all !== undefined ? next.all : current.all,
	};
}

function getCurrentUserId(): string | null {
	return getContext().get<AuthUser | null>("user")?.id ?? null;
}

function appendPendingInvalidation(
	payload: ClientInvalidationPayload,
	targetUserId: string | null | undefined,
): void {
	const ctx = getContext();
	const currentUserId = getCurrentUserId();
	const isCurrentUser = !targetUserId || (!!currentUserId && targetUserId === currentUserId);
	if (!isCurrentUser) return;

	const current = ctx.get<ClientInvalidationPayload>(PENDING_INVALIDATION_KEY) ?? {};
	ctx.set(PENDING_INVALIDATION_KEY, mergePayloads(current, payload));
}

async function resolveTargetUserId(input: InvalidateInput): Promise<string | null> {
	if (input.userId) return input.userId;

	const currentUserId = getCurrentUserId();
	if (currentUserId) return currentUserId;
	if (!getAuth) return null;

	const { user } = await getAuth().getSession();
	return user?.id ?? null;
}

function resolveDispatchTarget(input: InvalidateInput): {
	target: "all" | "except-current";
	connectionId: string | undefined;
} {
	const connectionId = getContext().req?.headers.get(CONNECTION_HEADER) ?? undefined;
	const currentUserId = getCurrentUserId();
	const isCurrentUser = !input.userId || (!!currentUserId && input.userId === currentUserId);
	const canSkip = isCurrentUser && !!connectionId && !input.auth && !input.all;

	return canSkip
		? { target: "except-current", connectionId }
		: { target: "all", connectionId: undefined };
}

export function invalidate(input: InvalidateInput): void {
	if (!getConduit) {
		throw new Error("[app-kit/conduit] Conduit has not been initialized. Call createConduit(...).");
	}

	const loadConduit = getConduit;

	const payload = normalizePayload(input);
	if (!payload) return;

	appendPendingInvalidation(payload, input.userId);

	const background = (async () => {
		const userId = await resolveTargetUserId(input);
		if (!userId) return;

		const conduit = await loadConduit(userId);
		await conduit.send("invalidate-client", payload, resolveDispatchTarget(input));
	})();

	getContext().waitUntil(
		background.catch((error) => {
			console.error("[app-kit/conduit] invalidate error:", error);
		}),
	);
}

export function getPendingInvalidation(): ClientInvalidationPayload | undefined {
	return tryGetContext()?.get<ClientInvalidationPayload>(PENDING_INVALIDATION_KEY);
}

/**
 * Create the server-side conduit.
 *
 * @example
 * ```ts
 * import { createConduit, ConduitDO, invalidate } from "@logoutrd/app-kit/server/conduit";
 * import { getServerByName } from "partyserver";
 * import { env } from "$lib/server/context";
 *
 * export { ConduitDO };
 *
 * export const conduit = createConduit({
 *   getDO: (userId) => getServerByName(env.CONDUIT, userId),
 * });
 *
 * app.all("/api/conduit/*", (c) => conduit.mount(c.req.raw));
 *
 * rpcFn({
 *   async handler() {
 *     invalidate({ depends: ["user"] });
 *   },
 * });
 * ```
 */
export function createConduit(options: ConduitOptions) {
	getConduit = options.getDO;

	if (options.onMessage) {
		for (const [key, handler] of Object.entries(options.onMessage)) {
			ConduitDO.on(key, handler);
		}
	}

	const route = createConduitRoute(options.getDO);

	return {
		mount: (request: Request) => route.fetch(request),
	};
}

export { ConduitDO } from "./conduit-do.js";
