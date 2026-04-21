/** Return the MIME type string for a given extension (without leading dot). */
export function getMimeType(ext: string): string | undefined {
	const map: Record<string, string> = {
		jpg: "image/jpeg",
		jpeg: "image/jpeg",
		png: "image/png",
		gif: "image/gif",
		webp: "image/webp",
		avif: "image/avif",
		svg: "image/svg+xml",
		mp4: "video/mp4",
		webm: "video/webm",
		mov: "video/quicktime",
		avi: "video/x-msvideo",
		mp3: "audio/mpeg",
		wav: "audio/wav",
		ogg: "audio/ogg",
		pdf: "application/pdf",
		doc: "application/msword",
		docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
		xls: "application/vnd.ms-excel",
		xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
	};
	return map[ext.toLowerCase().replace(/^\./, "")];
}

/** Return the canonical extension for a MIME type (without leading dot), or null. */
export function getExtensionFromMime(mimeType: string): string | null {
	const map: Record<string, string> = {
		"image/jpeg": "jpg",
		"image/png": "png",
		"image/gif": "gif",
		"image/webp": "webp",
		"image/avif": "avif",
		"image/svg+xml": "svg",
		"video/mp4": "mp4",
		"video/webm": "webm",
		"video/quicktime": "mov",
		"audio/mpeg": "mp3",
		"audio/wav": "wav",
		"audio/ogg": "ogg",
		"application/pdf": "pdf",
	};
	return map[mimeType] ?? null;
}

export const isImage = (mime: string): boolean => mime.startsWith("image/");
export const isVideo = (mime: string): boolean => mime.startsWith("video/");
export const isAudio = (mime: string): boolean => mime.startsWith("audio/");
export const isDocument = (mime: string): boolean =>
	mime.startsWith("application/pdf") ||
	mime.startsWith("application/msword") ||
	mime.includes("officedocument") ||
	mime.startsWith("text/");

export const supportsThumbnail = (mime: string): boolean => isImage(mime) || isVideo(mime);
