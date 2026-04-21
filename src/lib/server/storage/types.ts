/** Row shape when a file is tracked in the database. */
export type FileRecord = {
	id: string;
	userId?: string | null;
	name: string;
	path: string;
	type: string;
	size: number;
	thumbnail?: string | null;
	meta?: Record<string, unknown> | null;
	createdAt?: Date | string | null;
	updatedAt?: Date | string | null;
	deletedAt?: Date | string | null;
};

/** Result returned by `storage.upload`. */
export type UploadResult = FileRecord & { url: string };

export type UploadOptions = {
	/** Sub-folder inside R2, e.g. "avatars" or "documents". Defaults to "uploads". */
	folder?: string;
	/** Override the generated filename (with extension). */
	filename?: string;
	/** Associate the upload with a user ID. */
	userId?: string;
};

export type MediaInfoResponse = {
	type: "image" | "video" | "audio";
	width?: number;
	height?: number;
	duration?: number;
	size?: number;
};

/** Minimal DB interface the storage factory needs when tracking files. */
export type StorageDb = {
	insertFile: (row: Omit<FileRecord, "id" | "createdAt" | "updatedAt" | "deletedAt">) => Promise<FileRecord>;
	updateFileMeta: (id: string, meta: Record<string, unknown>) => Promise<void>;
	softDeleteFile: (path: string) => Promise<void>;
};
