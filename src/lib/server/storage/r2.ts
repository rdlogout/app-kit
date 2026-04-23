import { createEnv } from "../env.js";

type PutOptions = Parameters<R2Bucket["put"]>[2];

type UploadInput = {
	file: File | URL;
	folder: string;
	path: string;
	options?: PutOptions;
};

type CreateStorageOptions<TEnv extends Record<string, unknown> = {}> = {
	R2_KEY: keyof TEnv | string;
	beforeUpload?: (input: UploadInput) => void | Promise<void>;
	afterUpload?: (path: string, input: UploadInput) => void | Promise<void>;
	beforeDelete?: (path: string) => void | Promise<void>;
	afterDelete?: (path: string) => void | Promise<void>;
};

function fileNameFromUrl(url: URL): string {
	return url.pathname.split("/").filter(Boolean).pop() || crypto.randomUUID();
}

function joinPath(folder: string, name: string): string {
	const cleanFolder = folder.replace(/^\/+|\/+$/g, "");
	return cleanFolder ? `${cleanFolder}/${name}` : name;
}

export function createStorage<TEnv extends Record<string, unknown> = {}>(options: CreateStorageOptions<TEnv>) {
	const env = createEnv<TEnv>();
	const getBucket = () => env[options.R2_KEY as keyof typeof env] as R2Bucket;

	async function downloadFile(url: URL): Promise<File> {
		const response = await fetch(url);
		if (!response.ok) throw new Error(`[app-kit/storage] Failed to download ${url.toString()}.`);
		const blob = await response.blob();
		return new File([blob], fileNameFromUrl(url), { type: blob.type });
	}

	return {
		get(path: string) {
			return getBucket().get(path);
		},
		list(prefix?: string) {
			return prefix ? getBucket().list({ prefix }) : getBucket().list();
		},
		downloadFile,
		async upload(file: File | URL, folder: string, putOptions?: PutOptions) {
			const resolvedFile = file instanceof URL ? await downloadFile(file) : file;
			const path = joinPath(folder, resolvedFile.name);
			const input = { file, folder, path, options: putOptions };
			await options.beforeUpload?.(input);
			await getBucket().put(path, resolvedFile, putOptions);
			await options.afterUpload?.(path, input);
			return path;
		},
		async delete(path: string) {
			await options.beforeDelete?.(path);
			await getBucket().delete(path);
			await options.afterDelete?.(path);
		},
	};
}
