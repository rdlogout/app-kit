import type {
  Connection,
  ConnectionContext,
  WSMessage,
} from "partyserver";
import { runDOContext } from "./context/runtime.js";
import { safeWrapper } from "../shared/utils/wrapper.js";
import { getDO, ServerBase } from "./durables.js";
import type { BaseEnv } from "./env.js";

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

type ConduitConnectHandler = (
  userId: string,
  conn: Connection,
  ctx: ConnectionContext,
) => unknown;

type ConduitCloseHandler = (
  userId: string,
  conn: Connection,
  ctx: ConnectionContext,
) => unknown;

export type ConfigureConduitOptions = {
  onMessage?: Record<string, MessageHandler>;
  onConnect?: ConduitConnectHandler;
  onClose?: ConduitCloseHandler;
};

const messageHandlers: Map<string, MessageHandler> = new Map();
const connectionContexts: Map<string, ConnectionContext> = new Map();
let onConnectHandler: ConduitConnectHandler | null = null;
let onCloseHandler: ConduitCloseHandler | null = null;

export class ConduitDO<TEnv extends BaseEnv = BaseEnv> extends ServerBase<TEnv> {
  static options = { hibernate: true };

  async onMessage(conn: Connection, msg: WSMessage): Promise<void> {
    if (typeof msg !== "string") return;

    const { error } = await safeWrapper(async () => {
      const frame = JSON.parse(msg) as MessageFrame;
      if (frame.replyTo || !frame.key) return;

      const handler = messageHandlers.get(frame.key);
      if (!handler) return;

      try {
        const result = await runDOContext(
          () => Promise.resolve(handler(frame.data, conn)),
          this as unknown as {
            env: TEnv;
            ctx: { waitUntil: (p: Promise<unknown>) => void };
          },
        );

        if (frame.id) {
          conn.send(
            JSON.stringify({
              replyTo: frame.id,
              data: result ?? null,
            } satisfies MessageFrame),
          );
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
    connectionContexts.set(conn.id, _ctx);

    if (onConnectHandler) {
      const userId = this.name;
      await runDOContext(
        () => Promise.resolve(onConnectHandler?.(userId, conn, _ctx)),
        this as unknown as {
          env: TEnv;
          ctx: { waitUntil: (p: Promise<unknown>) => void };
        },
      );
    }

    conn.send(
      JSON.stringify({
        key: "connected",
        data: { connectionId: conn.id },
      } satisfies MessageFrame),
    );
  }

  async onClose(conn: Connection): Promise<void> {
    const ctx = connectionContexts.get(conn.id);
    connectionContexts.delete(conn.id);

    if (!onCloseHandler || !ctx) return;

    const userId = this.name;
    await runDOContext(
      () => Promise.resolve(onCloseHandler?.(userId, conn, ctx)),
      this as unknown as {
        env: TEnv;
        ctx: { waitUntil: (p: Promise<unknown>) => void };
      },
    );
  }

  dispatch(json: string, target: DispatchTarget = "all", id = ""): void {
    for (const conn of this.getConnections()) {
      if (target === "specific" && conn.id !== id) continue;
      if (target === "except-current" && conn.id === id) continue;
      conn.send(json);
    }
  }

  send(key: string, data: unknown, opts: ConduitSendOpts = {}): void {
    this.dispatch(
      JSON.stringify({ key, data } satisfies MessageFrame),
      opts.target ?? "all",
      opts.connectionId ?? "",
    );
  }
}

export function configureConduit(
  options: ConfigureConduitOptions = {},
): typeof ConduitDO {
  messageHandlers.clear();
  for (const [key, handler] of Object.entries(options.onMessage ?? {})) {
    messageHandlers.set(key, handler);
  }

  onConnectHandler = options.onConnect ?? null;
  onCloseHandler = options.onClose ?? null;
  return ConduitDO;
}

export async function getConduit(id: string): Promise<ConduitDO> {
  return getDO<ConduitDO>(id, { binding: "CONDUIT" });
}
