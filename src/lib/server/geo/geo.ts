/**
 * Geo / request metadata extracted from Cloudflare's `request.cf` object
 * and standard CF forwarding headers.
 */
export type CloudflareGeoData = {
	country: string | null;
	city: string | null;
	region: string | null;
	/** Cloudflare datacenter (e.g. "SIN", "FRA"). */
	colo: string | null;
	timeZone: string | null;
	latitude: string | null;
	longitude: string | null;
	ipAddress: string | null;
	userAgent: string | null;
};

/** Minimal subset of `IncomingRequestCfProperties` we actually read. */
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

/**
 * Extract geo / request metadata from a Cloudflare Worker request.
 *
 * Works with both `request.cf` (available inside a Worker) and the standard
 * Cloudflare forwarding headers (available in some edge environments).
 *
 * Returns `null` for every field if neither source is present (e.g. in tests).
 *
 * @example
 * ```ts
 * import { getGeoData } from "@logoutrd/app-kit/server/geo";
 *
 * const geo = getGeoData(request);
 * // geo.country, geo.city, geo.timeZone ...
 * ```
 */
export function getGeoData(request?: Request | null): CloudflareGeoData {
	const req = request as RequestWithCf | null | undefined;
	const cf = req?.cf;
	const headers = req?.headers;

	const toStr = (v: number | string | null | undefined): string | null =>
		v !== undefined && v !== null ? String(v) : null;

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
