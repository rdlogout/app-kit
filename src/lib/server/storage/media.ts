import { safeWrapper, safeParse } from "../../shared/utils/wrapper.js";
import type { MediaInfoResponse } from "./types.js";

const DEFAULT_MEDIA_API_URL = "";

type MediaParams = Record<string, string>;

async function fetchMedia(
	apiUrl: string,
	params: MediaParams,
): Promise<Response | null> {
	if (!apiUrl) return null;
	const { data, error } = await safeWrapper(async () => {
		const qs = new URLSearchParams(params);
		const res = await fetch(`${apiUrl}?${qs.toString()}`, { method: "GET" });
		return res.ok ? res : null;
	});
	if (error) console.error("[app-kit/storage/media] fetch error:", error.message);
	return data ?? null;
}

function parseInfoHeader(header: string | null): MediaInfoResponse | null {
	if (!header) return null;
	const { data } = safeParse<MediaInfoResponse>(header);
	return data;
}

/**
 * Create media helpers (getInfo, resize, getThumbnail) bound to a
 * configurable media processing API URL.
 *
 * When `apiUrl` is omitted or empty, all helpers return `null` gracefully.
 */
export function createMediaHelpers(apiUrl: string = DEFAULT_MEDIA_API_URL) {
	async function getInfo(url: string): Promise<MediaInfoResponse | null> {
		const res = await fetchMedia(apiUrl, { url, mode: "info" });
		if (!res) return null;
		return parseInfoHeader(res.headers.get("X-Info"));
	}

	async function resize(
		url: string,
		opts: { width?: number; height?: number } = {},
	): Promise<{ file: File; info: MediaInfoResponse } | null> {
		const params: MediaParams = { url };
		if (opts.width) params.width = String(opts.width);
		if (opts.height) params.height = String(opts.height);

		const res = await fetchMedia(apiUrl, params);
		if (!res) return null;

		const info = parseInfoHeader(res.headers.get("X-Info"));
		if (!info) return null;

		const blob = await res.blob();
		const filename = url.split("/").pop()?.split("?")[0] ?? "resized";
		return { file: new File([blob], filename, { type: blob.type }), info };
	}

	async function getThumbnail(
		url: string,
		opts: { width?: number; height?: number } = {},
	): Promise<{ file: File; info: MediaInfoResponse } | null> {
		const params: MediaParams = { url };
		if (opts.width) params.width = String(opts.width);
		if (opts.height) params.height = String(opts.height);

		const res = await fetchMedia(apiUrl, params);
		if (!res) return null;

		const info = parseInfoHeader(res.headers.get("X-Info"));
		if (!info) return null;

		const blob = await res.blob();
		const stem = (url.split("/").pop()?.split("?")[0] ?? "thumb").replace(/\.[^.]+$/, "");
		return {
			file: new File([blob], `${stem}_thumb.png`, { type: "image/png" }),
			info,
		};
	}

	return { getInfo, resize, getThumbnail };
}
