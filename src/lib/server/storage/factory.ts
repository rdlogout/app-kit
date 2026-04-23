import { getMimeType, isImage } from "./mime.js";
import { Hono } from "hono";
import { z } from "zod";
import type { UploadOptions, UploadResult } from "./types.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Resolver<T> = T | (() => T);

export type CreateStorageOptions = {
	r2: Resolver<R2Bucket>;
	baseUrl: Resolver<string>;
	assets?: Resolver<Fetcher>;
	images?: Resolver<ImagesBinding>;
};

export type StorageClient = {
	upload: (input: File | string, opts?: UploadOptions) => Promise<UploadResult>;
	get: (path: string) => Promise<R2ObjectBody | null>;
	delete: (path: string) => Promise<void>;
	getR2: () => R2Bucket;
	getFileUrl: (path: string) => string;
	getAsset: (path: string) => Promise<Response>;
};

export type CreateStorageResult = {
	storage: StorageClient;
	assetRoute: Hono;
};

const transformSchema = z.object({
	key: z.string().min(1),
	width: z.coerce.number().int().positive().max(4096).optional(),
	height: z.coerce.number().int().positive().max(4096).optional(),
	quality: z.enum(["low", "medium", "high"]).optional(),
	mode: z.enum(["contain", "cover", "crop", "scale-down"]).optional(),
	format: z.enum(["auto", "webp", "avif", "jpeg", "png"]).optional(),
});

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Create a storage client backed by Cloudflare R2.
 *
 * @example
 * ```ts
 * import { createStorage } from "@logoutrd/app-kit/server/storage";
 * import { getContext } from "@logoutrd/app-kit/server/context";
 *
 * export const storage = createStorage({
 *   r2:      () => getContext<Env>().env.STORAGE,
 *   baseUrl: () => "https://myapp.com",
 *   assets:  () => getContext<Env>().env.PRIVATE_ASSETS,
 * });
 * ```
 */
export function createStorage(options: CreateStorageOptions): CreateStorageResult {
	const resolve = <T>(value: Resolver<T>): T => (typeof value === "function" ? (value as () => T)() : value);

	function getFileUrl(path: string): string {
		return `${resolve(options.baseUrl)}/assets?key=${encodeURIComponent(path)}`;
	}

	async function getAsset(path: string): Promise<Response> {
		const url = new URL(path, resolve(options.baseUrl)).toString();
		const assets = options.assets ? resolve(options.assets) : null;
		return assets ? assets.fetch(url) : fetch(url);
	}

	async function upload(
		input: File | string,
		opts: UploadOptions = {},
	): Promise<UploadResult> {
		const bucket = resolve(options.r2);
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

		return {
			id: crypto.randomUUID(),
			userId: opts.userId,
			name: originalName,
			path,
			type: mimeType,
			size: file.size,
			thumbnail: isImage(mimeType) ? path : null,
			meta: { original_name: originalName },
			url: getFileUrl(path),
		};
	}

	async function get(path: string): Promise<R2ObjectBody | null> {
		return resolve(options.r2).get(path);
	}

	async function del(path: string): Promise<void> {
		await resolve(options.r2).delete(path);
	}

	const storage = {
		upload,
		get,
		delete: del,
		getR2: () => resolve(options.r2),
		getFileUrl,
		getAsset,
	};

	const assetRoute = new Hono().get("/", async (c) => {
		const url = new URL(c.req.raw.url);
		const raw: Record<string, string> = {};
		url.searchParams.forEach((value, key) => {
			raw[key] = value;
		});

		const parsed = transformSchema.safeParse(raw);
		if (!parsed.success) return c.json({ error: "Validation error", details: parsed.error.flatten() }, 400);

		const input = parsed.data;
		const cacheKey = new Request(url.toString(), c.req.raw);
		const cache = (caches as unknown as { default: Cache }).default;
		const cached = await cache.match(cacheKey);
		if (cached) return cached;

		const object = await storage.get(input.key);
		if (!object) return c.json({ error: "Not found" }, 404);

		const contentType = object.httpMetadata?.contentType || "";
		const shouldTransform =
			!!options.images &&
			contentType.startsWith("image/") &&
			!!(input.width || input.height || input.quality || input.mode || input.format);

		let response: Response;
		if (shouldTransform) {
			const imageBody = await object.arrayBuffer();
			const transform: Record<string, string | number> = {};
			if (input.width) transform.width = input.width;
			if (input.height) transform.height = input.height;
			if (input.mode) transform.fit = input.mode;
			if (input.format && input.format !== "auto") transform.format = input.format;
			if (input.quality) transform.quality = { low: 60, medium: 80, high: 95 }[input.quality];

			try {
				const transformedImage = await resolve(options.images as Resolver<ImagesBinding>)
					.input(imageBody as never)
					.transform(transform)
					.output({ format: "image/avif" });
				response = transformedImage.response() as unknown as Response;
			} catch {
				response = new Response(imageBody);
			}
		} else {
			response = new Response(object.body);
		}

		const headers = new Headers();
		object.writeHttpMetadata(headers);
		headers.set("etag", object.httpEtag);
		headers.set("cache-control", "public, max-age=31536000, immutable");
		response = new Response(response.body, { headers });
		c.executionCtx.waitUntil(cache.put(cacheKey, response.clone()));
		return response;
	});

	return { storage, assetRoute };
}
