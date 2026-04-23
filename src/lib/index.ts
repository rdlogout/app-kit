// ── Server ────────────────────────────────────────────────────────────────────
export { rpcFn, authRequired, createRpcRouter, createRpcHandler } from "./server/rpc/index.js";
export type { RpcRouter, RpcResponse } from "./server/rpc/index.js";

export { createEnv } from "./server/env.js";
export type { BaseEnv, CreateEnvDefaults, CreateEnvResult } from "./server/env.js";

export { wrapContext, runDOContext, getContext, tryGetContext, waitUntil } from "./server/context/index.js";
export type { AppContext } from "./server/context/index.js";

export { configureRoutes } from "./server/routes.js";

export { configureCron } from "./server/cron.js";
export type { CronHandler, CronHandlers, ConfigureCronResult } from "./server/cron.js";

export { createEmailHandler, createEmailSender } from "./server/email/index.js";
export type {
	CreateEmailHandler,
	CreateEmailHandlerCallback,
	CreateEmailSenderOptions,
	EmailHandlerInput,
	EmailHeaderMap,
	EmailSenderHandleArgs,
	EmailSender,
	EmailTransportMessage,
	SendEmailOptions,
	ParsedEmail,
	ParsedEmailAddress,
	ParsedEmailAttachment,
} from "./server/email/index.js";

export { createDB, extendDbListSchema, fetchList } from "./server/db/index.js";
export type {
	CreateDBOptions,
	DatabaseWithList,
	DbListCursorConfig,
	DbListFilter,
	DbListFilterConfig,
	DbListInput,
	DbListSort,
	DbListSortConfig,
	FetchListProps,
	FetchListResult,
	InferQueryItem,
	ListFilterMode,
	OrderByDirection,
} from "./server/db/index.js";

export { getGeoData } from "./server/hono.js";

export { createAuth as createServerAuth } from "./server/auth/index.js";

export { createStorage } from "./server/storage/index.js";

// ── Client ────────────────────────────────────────────────────────────────────
export { createAuth } from "./client/auth.js";

export { createAppState } from "./client/state.svelte.js";
export type { AppState } from "./client/state.svelte.js";

export { createApi, ApiState } from "./client/api/index.js";

// ── Shared ────────────────────────────────────────────────────────────────────
export { safeWrapper, safeParse } from "./shared/utils/wrapper.js";
