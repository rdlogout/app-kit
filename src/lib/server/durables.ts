import type { Connection, Server, getServerByName } from "partyserver";
import { createEnv } from "./env.js";
import type { BaseEnv } from "./env.js";

type PartyServerModule = {
	Server: typeof Server;
	getServerByName: typeof getServerByName;
};

type GetServerOptions = NonNullable<Parameters<typeof getServerByName>[2]>;
type DurableLocationHint = GetServerOptions extends {
	locationHint?: infer THint;
}
	? THint
	: never;

export type GetDOOptions = {
	binding: string;
	locationHint?: DurableLocationHint;
};

const isWorkersRuntime =
	typeof globalThis.navigator !== "undefined" &&
	globalThis.navigator.userAgent === "Cloudflare-Workers";

export class FallbackServer<TEnv extends BaseEnv = BaseEnv> {
	env!: TEnv;
	ctx!: { waitUntil: (p: Promise<unknown>) => void };
	name = "";

	getConnections(): Iterable<Connection> {
		return [];
	}

	fetch(_request: Request): Promise<Response> {
		throw new Error(
			"[app-kit/durables] Durable Objects are only available in Cloudflare Workers.",
		);
	}
}

const partyserver: PartyServerModule | null = isWorkersRuntime
	? ((await import("partyserver")) as PartyServerModule)
	: null;

export const ServerBase = (partyserver?.Server ?? FallbackServer) as typeof FallbackServer;

const getServerByNameRuntime = partyserver?.getServerByName ?? null;
const env = createEnv<Record<string, unknown>>();

export async function getDO<T>(id: string, options: GetDOOptions): Promise<T> {
	if (!getServerByNameRuntime) {
		throw new Error(
			"[app-kit/durables] getDO() is only available in Cloudflare Workers.",
		);
	}

	const values = env as unknown as Record<string, unknown>;
	const namespace = values[options.binding] as DurableObjectNamespace<Server> | undefined;
	if (!namespace) {
		throw new Error(
			`[app-kit/durables] Missing Durable Object binding \`${options.binding}\`.`,
		);
	}

	const locationHint = options.locationHint ?? (env.LOCATION_HINT as DurableLocationHint | undefined);
	return (await getServerByNameRuntime(namespace, id, { locationHint })) as unknown as T;
}
