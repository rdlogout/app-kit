import { isAudio, isImage, isVideo, getMimeType } from "./mime.js";
import { createMediaHelpers } from "./media.js";
import { safeWrapper } from "../../shared/utils/wrapper.js";
import type { StorageDb, UploadOptions, UploadResult } from "./types.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CreateStorageOptions = {
	/** Return the R2 bucket (called per-request via a context proxy). */
	getR2: () => R2Bucket;
	/** Return the canonical base URL for building public file URLs. */
	getBaseUrl: () => string;
	/** Schedule background tasks after the response is sent. */
	waitUntil?: (promise: Promise<unknown>) => void;
	/**
	 * Optional URL of your media processing API.
	 * When provided, video thumbnails and media metadata are extracted.
	 */
	mediaApiUrl?: string;
	/**
	 * Optional DB adapter for tracking uploaded files.
	 * When omitted, files are stored in R2 only (no DB record).
	 */
	db?: StorageDb;
};

export type StorageClient = {
	upload: (input: File | string, opts?: UploadOptions) => Promise<UploadResult>;
	get: (path: string) => Promise<R2ObjectBody | null>;
	delete: (path: string) => Promise<void>;
	getR2: () => R2Bucket;
	getFileUrl: (path: string) => string;
	getAsset: (path: string) => Promise<Response>;
};

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Create a storage client backed by Cloudflare R2.
 *
 * @example
 * ```ts
 * import { createStorage } from "@logoutrd/app-kit/server/storage";
 * import { getContext, waitUntil } from "@logoutrd/app-kit/server/context";
 *
 * export const storage = createStorage({
 *   getR2:      () => getContext<Env>().env.STORAGE,
 *   getBaseUrl: () => "https://myapp.com",
 *   waitUntil,
 *   mediaApiUrl: "https://my-media-api.example.com",
 *   db: myStorageDb,
 * });
 * ```
 */
export function createStorage(options: CreateStorageOptions): StorageClient {
	const { getR2, getBaseUrl, waitUntil, db } = options;
	const media = createMediaHelpers(options.mediaApiUrl);

	function getFileUrl(path: string): string {
		return `${getBaseUrl()}/assets?key=${encodeURIComponent(path)}`;
	}

	async function getAsset(path: string): Promise<Response> {
		// If the project binds an ASSETS fetcher, it should override this implementation.
		const url = getFileUrl(path);
		return fetch(url);
	}

	async function upload(
		input: File | string,
		opts: UploadOptions = {},
	): Promise<UploadResult> {
		const bucket = getR2();
		let file: File;
		let originalName: string;

		if (typeof input === "string") {
			const res = await fetch(input);
			if (!res.ok) throw new Error(`[storage] Fetch failed: ${res.status} ${input}`);
			const blob = await res.blob();
			const name = input.split("/").pop()?.split("?")[0] ?? crypto.randomUUID();
			originalName = name;
			file = new File([blob], name, {
				type: blob.type || getMimeType(name.split(".").pop() ?? "") || "application/octet-stream",
			});
		} else {
			file = input;
			originalName = file.name;
		}

		const folder = opts.folder ?? "uploads";
		const ext = file.name.split(".").pop() ?? "";
		const name = opts.filename ?? `${crypto.randomUUID()}${ext ? `.${ext}` : ""}`;
		const path = `${folder}/${name}`;
		const mimeType = file.type || "application/octet-stream";

		await bucket.put(path, await file.arrayBuffer(), {
			httpMetadata: { contentType: mimeType },
		});

		const thumbnailPath = isImage(mimeType)
			? path
			: isVideo(mimeType)
				? `${path}_thumbnail.avif`
				: null;

		const category = isImage(mimeType)
			? "image"
			: isVideo(mimeType)
				? "video"
				: isAudio(mimeType)
					? "audio"
					: "other";

		const baseMeta: Record<string, unknown> = { category, original_name: originalName };

		// Insert DB record if a db adapter was provided
		const fileRow = db
			? await db.insertFile({
					userId: opts.userId,
					name: originalName,
					path,
					type: mimeType,
					size: file.size,
					thumbnail: thumbnailPath ?? undefined,
					meta: baseMeta,
				})
			: ({
					id: crypto.randomUUID(),
					userId: opts.userId,
					name: originalName,
					path,
					type: mimeType,
					size: file.size,
					thumbnail: thumbnailPath,
					meta: baseMeta,
				} satisfies import("./types.js").FileRecord);

		const fileUrl = getFileUrl(fileRow.path);

		// Background: extract media info + generate thumbnail
		const backgroundTask = async () => {
			const metaUpdates: Record<string, unknown> = {};

			if (isImage(mimeType) || isVideo(mimeType) || isAudio(mimeType)) {
				const { data: info, error } = await safeWrapper(() => media.getInfo(fileUrl));
				if (error) console.error("[storage] media.getInfo error:", error.message);
				else if (info) Object.assign(metaUpdates, { width: info.width, height: info.height, duration: info.duration });
			}

			if (isVideo(mimeType) && thumbnailPath) {
				const { data: thumb, error } = await safeWrapper(() =>
					media.getThumbnail(fileUrl, { width: 320, height: 180 }),
				);
				if (error) console.error("[storage] thumbnail error:", error.message);
				else if (thumb) {
					await bucket.put(thumbnailPath, await thumb.file.arrayBuffer(), {
						httpMetadata: { contentType: "image/png" },
					});
				}
			}

			if (db && Object.keys(metaUpdates).length > 0) {
				await db.updateFileMeta(fileRow.id, { ...baseMeta, ...metaUpdates });
			}
		};

		if (waitUntil) {
			waitUntil(backgroundTask());
		} else {
			backgroundTask().catch((err) => console.error("[storage] background error:", err));
		}

		return { ...fileRow, url: fileUrl };
	}

	async function get(path: string): Promise<R2ObjectBody | null> {
		return getR2().get(path);
	}

	async function del(path: string): Promise<void> {
		await getR2().delete(path);
		if (db) await db.softDeleteFile(path);
	}

	return {
		upload,
		get,
		delete: del,
		getR2,
		getFileUrl,
		getAsset,
	};
}
