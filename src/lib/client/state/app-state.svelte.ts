import type { ClientInvalidationPayload } from "../api/types.js";

type RpcRefresh = () => Promise<unknown>;

/** Base primitive fields every AppState instance always contains. */
export type BaseAppStateValues = {
	realtimeConnectionId: string | null;
};

/**
 * Core AppState class with primitive fields and RPC invalidation registry.
 * Extend via `createAppState` — do not instantiate directly from consumer apps.
 */
export class AppState<Extra extends Record<string, unknown> = Record<never, never>> {
	/** Reactive values bag — contains base fields merged with any extra fields. */
	values = $state<BaseAppStateValues & Extra>({
		realtimeConnectionId: null,
	} as BaseAppStateValues & Extra);

	/** Registry of RPC cache keys → refresh callbacks used for fine-grained invalidation. */
	rpcRegistry = new Map<string, Set<RpcRefresh>>();

	get<K extends keyof (BaseAppStateValues & Extra)>(key: K) {
		return this.values[key];
	}

	set(patch: Partial<BaseAppStateValues & Extra>) {
		Object.assign(this.values, patch);
	}

	registerRpc(depends: string[], refresh: RpcRefresh) {
		for (const key of depends) {
			if (!this.rpcRegistry.has(key)) this.rpcRegistry.set(key, new Set());
			this.rpcRegistry.get(key)!.add(refresh);
		}
	}

	unregisterRpc(depends: string[], refresh: RpcRefresh) {
		for (const key of depends) {
			const set = this.rpcRegistry.get(key);
			if (!set) continue;
			set.delete(refresh);
			if (set.size === 0) this.rpcRegistry.delete(key);
		}
	}

	async invalidateClient(payload: ClientInvalidationPayload) {
		const refreshers = new Set<RpcRefresh>();

		if (payload.all) {
			for (const set of this.rpcRegistry.values()) {
				for (const refresh of set) refreshers.add(refresh);
			}
		}

		for (const key of payload.depends ?? []) {
			for (const refresh of this.rpcRegistry.get(key) ?? []) {
				refreshers.add(refresh);
			}
		}

		await Promise.allSettled([...refreshers].map((refresh) => refresh()));
	}
}

/**
 * Create a typed AppState instance with extra fields merged in.
 *
 * @example
 * ```ts
 * export const appState = createAppState({
 *   theme: "dark" as "light" | "dark",
 *   isMobile: false,
 * });
 * // appState.values.theme, appState.values.realtimeConnectionId, etc.
 * ```
 */
export function createAppState<Extra extends Record<string, unknown>>(
	extraDefaults: Extra,
): AppState<Extra> {
	const instance = new AppState<Extra>();
	// Merge extra defaults into the reactive state
	Object.assign(instance.values, extraDefaults);
	return instance;
}
