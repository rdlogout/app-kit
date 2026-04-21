import { Server } from "partyserver";
import type { Connection, ConnectionContext, WSMessage } from "partyserver";
import { runDOContext } from "../context/runtime.js";
import { safeWrapper } from "../../shared/utils/wrapper.js";
import type { BaseEnv } from "../context/env.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type DispatchTarget = "all" | "except-current" | "specific";

export type ConduitSendOpts = {
	target?: DispatchTarget;
	connectionId?: string;
};

type MessageFrame = {
	id?: string;
	replyTo?: string;
	key?: string;
	data?: unknown;
	error?: { message?: string };
};
type MessageHandler = (data: unknown, conn: Connection) => unknown;

// ---------------------------------------------------------------------------
// ConduitDO — generic Durable Object for real-time push
// ---------------------------------------------------------------------------

/**
 * Cloudflare Durable Object that acts as a per-user WebSocket hub.
 *
 * - Export this class from your Worker entry so Cloudflare can bind it.
 * - Use `ConduitDO.on(key, handler)` to register server-side message handlers.
 * - Call `send(key, data, opts)` to push messages to connected clients.
 *
 * @example
 * ```ts
 * // backend/src/index.ts
 * export { ConduitDO } from "@logoutrd/app-kit/server/conduit";
 * ```
 */
export class ConduitDO<TEnv extends BaseEnv = BaseEnv> extends Server<TEnv> {
	static options = { hibernate: true };

	// Class-level handler registry (shared across all instances in the process).
	private static readonly handlers: Map<string, MessageHandler> = new Map();

	/**
	 * Register a handler for a named message key sent from connected clients.
	 * Call this at module initialisation, before any connections arrive.
	 */
	static on(key: string, handler: MessageHandler): void {
		ConduitDO.handlers.set(key, handler);
	}

	async onMessage(conn: Connection, msg: WSMessage): Promise<void> {
		if (typeof msg !== "string") return;
		const { error } = await safeWrapper(async () => {
			const frame = JSON.parse(msg) as MessageFrame;
			if (frame.replyTo || !frame.key) return;

			const handler = ConduitDO.handlers.get(frame.key);
			if (!handler) return;

			try {
				const result = await runDOContext(
					() => Promise.resolve(handler(frame.data, conn)),
					this as unknown as { env: TEnv; ctx: { waitUntil: (p: Promise<unknown>) => void } },
				);

				if (frame.id) {
					conn.send(JSON.stringify({ replyTo: frame.id, data: result ?? null } satisfies MessageFrame));
				}
			} catch (handlerError) {
				if (!frame.id) throw handlerError;
				conn.send(
					JSON.stringify({
						replyTo: frame.id,
						error: {
							message:
								handlerError instanceof Error
									? handlerError.message
									: "Internal server error",
						},
					} satisfies MessageFrame),
				);
			}
		});
		if (error) console.error("[ConduitDO] onMessage error:", error.message);
	}

	async onConnect(conn: Connection, _ctx: ConnectionContext): Promise<void> {
		const frame: MessageFrame = { key: "connected", data: { connectionId: conn.id } };
		conn.send(JSON.stringify(frame));
	}

	/**
	 * Dispatch a raw JSON string to connected clients.
	 */
	dispatch(json: string, target: DispatchTarget = "all", id = ""): void {
		for (const conn of this.getConnections()) {
			if (target === "specific" && conn.id !== id) continue;
			if (target === "except-current" && conn.id === id) continue;
			conn.send(json);
		}
	}

	/**
	 * Send a named message frame to connected clients.
	 */
	send(key: string, data: unknown, opts: ConduitSendOpts = {}): void {
		const frame: MessageFrame = { key, data };
		this.dispatch(JSON.stringify(frame), opts.target ?? "all", opts.connectionId ?? "");
	}
}
