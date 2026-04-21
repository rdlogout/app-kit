// ── Server ────────────────────────────────────────────────────────────────────
export { rpcFn, authRequired, createRpcRouter, createRpcHandler } from "./server/rpc/index.js";
export type { RpcRouter, RpcResponse } from "./server/rpc/index.js";

export { runContext, runDOContext, getContext, tryGetContext, waitUntil, createEnvProxy } from "./server/context/index.js";
export type { AppContext, BaseEnv } from "./server/context/index.js";

export { getGeoData } from "./server/geo/index.js";

export { createAuth as createServerAuth } from "./server/auth/index.js";

export { createStorage, createKV, createCache } from "./server/storage/index.js";
export { getMimeType, isImage, isVideo, isAudio, isDocument } from "./server/storage/index.js";

// ── Client ────────────────────────────────────────────────────────────────────
export { createAuth } from "./client/auth.js";

export { createAppState } from "./client/state.svelte.js";
export type { AppState } from "./client/state.svelte.js";

export { createApi, ApiState } from "./client/api/index.js";

// ── Shared ────────────────────────────────────────────────────────────────────
export { safeWrapper, safeParse } from "./shared/utils/wrapper.js";
