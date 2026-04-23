import { consumeSetCookies, setHonoContext } from "./context/internal.js";

export type CloudflareGeoData = {
  country: string | null;
  city: string | null;
  region: string | null;
  colo: string | null;
  timeZone: string | null;
  latitude: string | null;
  longitude: string | null;
  ipAddress: string | null;
  userAgent: string | null;
};

type CfProperties = {
  country?: string | null;
  city?: string | null;
  region?: string | null;
  colo?: string | null;
  timezone?: string | null;
  latitude?: number | string | null;
  longitude?: number | string | null;
};

type RequestWithCf = Request & { cf?: CfProperties | null };

type ContextLike = {
  env: unknown;
  req: { raw: Request };
  executionCtx?: { waitUntil: (promise: Promise<unknown>) => void };
  res: Response;
};

type NextLike = () => Promise<void>;
type UseContextMiddleware = (c: ContextLike, next: NextLike) => Promise<void>;

export function getGeoData(request?: Request | null): CloudflareGeoData {
  const req = request as RequestWithCf | null | undefined;
  const cf = req?.cf;
  const headers = req?.headers;
  const toStr = (value: number | string | null | undefined): string | null =>
    value !== undefined && value !== null ? String(value) : null;

  return {
    country: cf?.country ?? headers?.get("cf-ipcountry") ?? null,
    city: cf?.city ?? headers?.get("cf-ipcity") ?? null,
    region: cf?.region ?? headers?.get("cf-region") ?? null,
    colo: cf?.colo ?? headers?.get("cf-ray")?.split("-")[1] ?? null,
    timeZone: cf?.timezone ?? null,
    latitude: toStr(cf?.latitude),
    longitude: toStr(cf?.longitude),
    ipAddress:
      headers?.get("cf-connecting-ip") ??
      headers?.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      null,
    userAgent: headers?.get("user-agent") ?? null,
  };
}

export function useContext(): UseContextMiddleware {
  return async (c: ContextLike, next: NextLike) => {
    setHonoContext(c);
    await next();

    for (const cookie of consumeSetCookies()) {
      c.res.headers.append("set-cookie", cookie);
    }
  };
}
