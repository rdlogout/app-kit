import type { ClientInvalidationPayload } from "./api/types.js";

type RpcRefresh = () => Promise<unknown>;

/** Base fields every app state contains. */
type BaseValues = { realtimeConnectionId: string | null };

class AppState<Extra extends Record<string, unknown> = Record<never, never>> {
	values = $state<BaseValues & Extra>({ realtimeConnectionId: null } as BaseValues & Extra);

	private readonly rpcRegistry = new Map<string, Set<RpcRefresh>>();

	get<K extends keyof (BaseValues & Extra)>(key: K) {
		return this.values[key];
	}

	set(patch: Partial<BaseValues & Extra>) {
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

	async invalidate(payload: ClientInvalidationPayload) {
		const refreshers = new Set<RpcRefresh>();
		if (payload.all) {
			for (const set of this.rpcRegistry.values()) {
				for (const r of set) refreshers.add(r);
			}
		}
		for (const key of payload.depends ?? []) {
			for (const r of this.rpcRegistry.get(key) ?? []) refreshers.add(r);
		}
		await Promise.allSettled([...refreshers].map((r) => r()));
	}
}

/**
 * Create a reactive app state with optional extra fields.
 *
 * @example
 * ```ts
 * export const appState = createAppState({ theme: "dark" as "light" | "dark" });
 * appState.values.theme         // typed
 * appState.values.realtimeConnectionId  // always present
 * ```
 */
export function createAppState<Extra extends Record<string, unknown>>(
	extra: Extra,
): AppState<Extra> {
	const state = new AppState<Extra>();
	Object.assign(state.values, extra);
	return state;
}

export type { AppState };
