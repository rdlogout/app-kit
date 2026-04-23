import { createEnv } from "../env.js";
import type { createStorage } from "./index.js";

type StorageInstance = ReturnType<typeof createStorage>;

type CreateAssetsRouteOptions<TEnv extends Record<string, unknown>> = {
	storage: StorageInstance;
	imagesKey?: keyof TEnv;
};

type ImageTransform = {
	width?: number;
	height?: number;
	fit?: "contain" | "cover" | "crop" | "scale-down";
	format?: "auto" | "webp" | "avif" | "jpeg" | "png";
	quality?: number;
};

function parsePositiveInt(value: string | null): number | undefined {
	if (!value) return undefined;
	const parsed = Number.parseInt(value, 10);
	return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}

function parseImageTransform(request: Request): ImageTransform | null {
	const params = new URL(request.url).searchParams;
	const transform: ImageTransform = {};
	const width = parsePositiveInt(params.get("width"));
	const height = parsePositiveInt(params.get("height"));
	const fit = params.get("mode");
	const format = params.get("format");
	const quality = params.get("quality");

	if (width) transform.width = width;
	if (height) transform.height = height;
	if (fit === "contain" || fit === "cover" || fit === "crop" || fit === "scale-down") transform.fit = fit;
	if (format === "auto" || format === "webp" || format === "avif" || format === "jpeg" || format === "png") {
		transform.format = format;
	}
	if (quality === "low") transform.quality = 60;
	if (quality === "medium") transform.quality = 80;
	if (quality === "high") transform.quality = 95;

	return Object.keys(transform).length ? transform : null;
}

async function createAssetResponse(
	request: Request,
	object: R2ObjectBody,
	images?: ImagesBinding,
): Promise<Response> {
	const contentType = object.httpMetadata?.contentType || "";
	const transform = images && contentType.startsWith("image/") ? parseImageTransform(request) : null;

	let response: Response;
	if (images && transform) {
		try {
			const transformed = await images
				.input((await object.arrayBuffer()) as never)
				.transform(transform)
				.output({ format: "image/avif" });
			response = transformed.response() as unknown as Response;
		} catch {
			response = new Response(object.body);
		}
	} else {
		response = new Response(object.body);
	}

	const headers = new Headers();
	object.writeHttpMetadata(headers);
	headers.set("etag", object.httpEtag);
	return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

export function createAssetsRoute<TEnv extends Record<string, unknown> = {}>(
	request: Request,
	assetPath: string,
	options: CreateAssetsRouteOptions<TEnv>,
): Promise<Response | null> {
	const env = createEnv<TEnv>();
	if (!assetPath) return Promise.resolve(null);

	return (async () => {
		const object = await options.storage.get(assetPath);
		if (!object) return null;

		const envValues = env as unknown as Record<string, unknown>;
		const images = options.imagesKey
			? (envValues[String(options.imagesKey)] as ImagesBinding | undefined)
			: undefined;
		return createAssetResponse(request, object, images);
	})();
}
