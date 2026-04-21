export type AppKitAuthData<TUser = unknown, TSession = unknown> = {
	user: TUser | null;
	session: TSession | null;
};

export type AppKitLocal<TUser = unknown, TSession = unknown> = {
	user: TUser | null;
	session?: TSession | null;
	getAuthData: () => Promise<AppKitAuthData<TUser, TSession>>;
};

export type AppKitLocals<TUser = unknown, TSession = unknown> = AppKitLocal<TUser, TSession>;

export type AppKitPlatform<TBinding extends string = "BACKEND"> = {
	env: { [K in TBinding]: Fetcher } & Record<string, unknown>;
};

export type AppKitCloudflareEnv<TBinding extends string = "BACKEND"> = {
	[K in TBinding]: Fetcher;
};

export type AppKitWindow<TRpcStore extends Record<string, unknown> = Record<string, unknown>> = {
	__RPC__?: TRpcStore;
};

export type CreateHandleOptions = {
	binding?: string;
	backendOriginEnv?: string;
	proxyPaths?: string[];
	extraProxyPaths?: string[];
	authPath?: string;
	rpcStoreKey?: string;
	injectRpc?: boolean;
};
