import { getAuth } from "./auth/auth.js";
import type { AuthUser } from "./auth/types.js";
import { getConduit } from "./conduit.js";
import { getContext } from "./context/runtime.js";

export type ClientInvalidationPayload = {
  depends?: string[];
  auth?: boolean;
  all?: boolean;
};

export type InvalidateInput = {
  depends?: string | string[] | null;
  auth?: boolean;
  all?: boolean;
};

const CONNECTION_HEADER = "x-conduit-connection-id";
const PENDING_INVALIDATION_KEY = "__app_kit_invalidate";
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

function normalizePayload(
  input: InvalidateInput,
): ClientInvalidationPayload | null {
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
  const depends = toDistinctList([
    ...(current.depends ?? []),
    ...(next.depends ?? []),
  ]);
  return {
    depends: depends.length ? depends : undefined,
    auth: next.auth !== undefined ? next.auth : current.auth,
    all: next.all !== undefined ? next.all : current.all,
  };
}

function getCurrentUserId(): string | null {
  return getContext().get<AuthUser | null>("user")?.id ?? null;
}

async function resolveConduit(userId?: string) {
  const resolvedUserId =
    userId || getCurrentUserId() || (await getAuth?.().getSession())?.user?.id;
  if (!resolvedUserId) return null;
  return getConduit(resolvedUserId);
}

function appendPendingInvalidation(
  payload: ClientInvalidationPayload,
  targetUserId?: string,
): void {
  const ctx = getContext();
  const currentUserId = getCurrentUserId();
  const isCurrentUser =
    !targetUserId || (!!currentUserId && targetUserId === currentUserId);
  if (!isCurrentUser) return;

  const current =
    ctx.get<ClientInvalidationPayload>(PENDING_INVALIDATION_KEY) ?? {};
  ctx.set(PENDING_INVALIDATION_KEY, mergePayloads(current, payload));
}

function resolveDispatchTarget(
  payload: ClientInvalidationPayload,
  targetUserId?: string,
): {
  target: "all" | "except-current";
  connectionId: string | undefined;
} {
  const connectionId =
    getContext().req?.headers.get(CONNECTION_HEADER) ?? undefined;
  const currentUserId = getCurrentUserId();
  const isCurrentUser =
    !targetUserId || (!!currentUserId && targetUserId === currentUserId);
  const canSkip =
    isCurrentUser && !!connectionId && !payload.auth && !payload.all;

  return canSkip
    ? { target: "except-current", connectionId }
    : { target: "all", connectionId: undefined };
}

export function invalidate(input: InvalidateInput, userId?: string): void {
  const payload = normalizePayload(input);
  if (!payload) return;

  appendPendingInvalidation(payload, userId);

  const background = (async () => {
    const conduit = await resolveConduit(userId);
    if (!conduit) return;

    conduit.send(
      "invalidate-client",
      payload,
      resolveDispatchTarget(payload, userId),
    );
  })();

  getContext().waitUntil(
    background.catch((error) => {
      console.error("[app-kit/invalidate] invalidate error:", error);
    }),
  );
}
