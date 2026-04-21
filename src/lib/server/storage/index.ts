export { createStorage } from "./factory.js";
export type { CreateStorageOptions, StorageClient } from "./factory.js";
export { createKV } from "./kv.js";
export type { KVStore } from "./kv.js";
export { createCache } from "./cache.js";
export type { CacheStore } from "./cache.js";
export { createMediaHelpers } from "./media.js";
export {
	getMimeType,
	getExtensionFromMime,
	isImage,
	isVideo,
	isAudio,
	isDocument,
	supportsThumbnail,
} from "./mime.js";
export type { FileRecord, UploadResult, UploadOptions, MediaInfoResponse, StorageDb } from "./types.js";
