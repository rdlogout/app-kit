import type { AppState } from "../state.svelte.js";
import type { ClientInvalidationPayload } from "../api/types.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ConduitOptions = {
  /**
   * Full WebSocket URL.  When omitted, `init()` will derive it from
   * `location.origin` (replacing `http(s)` with `ws(s)`) + `path`.
   */
  url?: string;

  /**
   * Path appended to the auto-derived origin URL.
   * @default "/api/conduit/ws"
   */
  path?: string;

  /**
   * Initial delay (ms) before the first reconnect attempt.
   * @default 1000
   */
  reconnectDelay?: number;

  /**
   * Maximum delay (ms) between reconnect attempts (exponential back-off cap).
   * @default 30_000
   */
  maxReconnectDelay?: number;
};

type MessageHandler<T = unknown> = (data: T) => void;
type PendingCall = {
  resolve: (value: any) => void;
  reject: (error: Error) => void;
};

// ---------------------------------------------------------------------------
// Minimal reconnecting WebSocket (native, no external dependency)
// ---------------------------------------------------------------------------

class ReconnectingSocket {
  private ws: WebSocket | null = null;
  private stopped = false;
  private delay: number;
  private readonly baseDelay: number;
  private readonly maxDelay: number;
  private readonly url: string;
  private readonly onMessage: (raw: string) => void;

  constructor(
    url: string,
    onMessage: (raw: string) => void,
    options: Pick<ConduitOptions, "reconnectDelay" | "maxReconnectDelay">,
  ) {
    this.url = url;
    this.onMessage = onMessage;
    this.baseDelay = options.reconnectDelay ?? 1_000;
    this.maxDelay = options.maxReconnectDelay ?? 30_000;
    this.delay = this.baseDelay;
    this.connect();
  }

  private connect() {
    if (this.stopped) return;

    this.ws = new WebSocket(this.url);

    this.ws.addEventListener("open", () => {
      this.delay = this.baseDelay; // reset back-off on successful connect
    });

    this.ws.addEventListener("message", (event: MessageEvent<string>) => {
      this.onMessage(event.data);
    });

    this.ws.addEventListener("close", () => {
      if (this.stopped) return;
      setTimeout(() => this.connect(), this.delay);
      this.delay = Math.min(this.delay * 2, this.maxDelay); // exponential back-off
    });
  }

  send(data: string) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(data);
    }
  }

  close() {
    this.stopped = true;
    this.ws?.close();
    this.ws = null;
  }
}

// ---------------------------------------------------------------------------
// ConduitClient — internal message router
// ---------------------------------------------------------------------------

type ConduitMessage = {
  id?: string;
  replyTo?: string;
  key?: string;
  data?: unknown;
  error?: { message?: string };
};

class ConduitClient {
  private socket: ReconnectingSocket | null = null;
  private readonly handlers = new Map<string, Set<MessageHandler>>();
  private readonly pending = new Map<string, PendingCall>();
  private readonly appState: AppState<Record<string, unknown>>;

  constructor(appState: AppState<Record<string, unknown>>) {
    this.appState = appState;
  }

  connect(url: string, options: ConduitOptions) {
    this.socket = new ReconnectingSocket(
      url,
      (raw) => this.dispatch(raw),
      options,
    );

    // Wire built-in events that every conduit connection must handle.
    this.on("connected", (data) => {
      const { connectionId } = data as { connectionId: string };
      this.appState.set({
        realtimeConnectionId: connectionId,
      } as Parameters<typeof this.appState.set>[0]);
    });

    this.on("invalidate-client", (payload) => {
      void this.appState.invalidate(payload as ClientInvalidationPayload);
    });
  }

  private dispatch(raw: string) {
    try {
      const { replyTo, key, data, error } = JSON.parse(raw) as ConduitMessage;
      if (replyTo) {
        const pending = this.pending.get(replyTo);
        if (!pending) return;
        this.pending.delete(replyTo);
        if (error?.message) pending.reject(new Error(error.message));
        else pending.resolve(data);
        return;
      }

      if (!key) return;
      this.handlers.get(key)?.forEach((fn) => fn(data));
    } catch {
      // Silently ignore malformed frames — keeps the connection alive.
    }
  }

  send(key: string, data?: unknown) {
    this.socket?.send(JSON.stringify({ key, data }));
  }

  call<T = unknown>(key: string, data?: unknown): Promise<T> {
    const id = crypto.randomUUID();
    return new Promise<T>((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.socket?.send(JSON.stringify({ id, key, data }));
    });
  }

  on<T = unknown>(key: string, fn: MessageHandler<T>): () => void {
    if (!this.handlers.has(key)) this.handlers.set(key, new Set());
    // Cast is safe: the caller controls the generic T at the call site.
    this.handlers.get(key)!.add(fn as MessageHandler);
    return () => this.handlers.get(key)?.delete(fn as MessageHandler);
  }

  off<T = unknown>(key: string, fn: MessageHandler<T>) {
    this.handlers.get(key)?.delete(fn as MessageHandler);
  }

  disconnect() {
    this.socket?.close();
    this.socket = null;
    this.handlers.clear();
  }
}

// ---------------------------------------------------------------------------
// Public factory
// ---------------------------------------------------------------------------

/**
 * Create a conduit (WebSocket) client wired to the given `appState`.
 *
 * Internally this uses a reconnecting native WebSocket with exponential
 * back-off — no external dependencies required.
 *
 * The client automatically:
 * - Stores the realtime `connectionId` in `appState.values.realtimeConnectionId`
 * - Forwards `invalidate-client` server frames to `appState.invalidateClient`
 *
 * @example
 * ```ts
 * // src/lib/conduit.svelte.ts
 * import { createConduit } from "@logoutrd/app-kit/client/conduit";
 * import { appState } from "$lib/state/app-state.svelte";
 *
 * export const conduit = createConduit(appState);
 *
 * conduit.init();
 * ```
 */
export function createConduit(
  appState: AppState<Record<string, unknown>>,
  options: ConduitOptions = {},
) {
  const client = new ConduitClient(appState);

  return {
    /**
     * Subscribe to a named server-push event.
     * Returns an unsubscribe function.
     */
    on: <T = unknown>(key: string, fn: MessageHandler<T>) => client.on(key, fn),

    /** Unsubscribe a specific handler from a named event. */
    off: <T = unknown>(key: string, fn: MessageHandler<T>) =>
      client.off(key, fn),

    /** Send a named message to the server over the WebSocket. */
    send: (key: string, data?: unknown) => client.send(key, data),

    /** Call a named request-response server handler over the WebSocket. */
    call: <T = unknown>(key: string, data?: unknown) =>
      client.call<T>(key, data),

    /**
     * Open the WebSocket connection. Call once in the browser (e.g. in a
     * root layout's `onMount`).  The connection will automatically reconnect
     * with exponential back-off if it drops.
     */
    init(url?: string) {
      if (typeof window === "undefined") return;

      const resolvedUrl =
        url ??
        options.url ??
        (typeof location !== "undefined"
          ? location.origin.replace(/^https?/, (p) =>
              p === "https" ? "wss" : "ws",
            ) + (options.path ?? "/api/conduit/ws")
          : null);

      if (!resolvedUrl) {
        console.warn(
          "[conduit] Cannot derive WebSocket URL — provide one explicitly or call initConduit() in the browser.",
        );
        return;
      }

      client.connect(resolvedUrl, options);
    },

    /** Close the connection and clean up all handlers. */
    destroy() {
      client.disconnect();
    },
  };
}
