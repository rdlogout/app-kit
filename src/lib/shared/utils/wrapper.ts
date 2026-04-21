export type SafeResult<T> = {
	error: Error | null;
	data: T | null;
};

function toError(error: unknown): Error {
	if (error instanceof Error) return error;
	return new Error(String(error));
}

export async function safeWrapper<T>(fn: () => Promise<T>): Promise<SafeResult<T>> {
	try {
		const data = await fn();
		return { error: null, data };
	} catch (error) {
		return { error: toError(error), data: null };
	}
}

export function safeParse<T>(json: string): SafeResult<T> {
	try {
		return { error: null, data: JSON.parse(json) as T };
	} catch (error) {
		return { error: toError(error), data: null };
	}
}
