import { getContext, tryGetContext } from "./context/runtime.js";

export interface BaseEnv {
	NAME: string;
	DOMAIN: string;
	SECRET?: string;
	IS_DEV?: "true" | "false";
	DEV_HOST?: string;
	DEV_PORT?: string;
	LOCATION_HINT?: string;
}

type AppEnv<TEnv extends Record<string, unknown>> = BaseEnv & TEnv;

export type CreateEnvDefaults<TEnv extends Record<string, unknown>> = Partial<AppEnv<TEnv>>;

export type CreateEnvResult<TEnv extends Record<string, unknown>> = Omit<
	AppEnv<TEnv>,
	"IS_DEV" | "BASE_URL" | "PROD_URL" | "DEV_URL" | "LOCATION_HINT"
> & {
	IS_DEV: boolean;
	BASE_URL: string;
	PROD_URL: string;
	DEV_URL: string;
	LOCATION_HINT: string;
};

const ENV_DEFAULTS = {
	DEV_HOST: "localhost",
	DEV_PORT: "5173",
	IS_DEV: "false",
	LOCATION_HINT: "apac",
} as const;

type DerivedEnvKey = "IS_DEV" | "BASE_URL" | "PROD_URL" | "DEV_URL" | "LOCATION_HINT";
type DerivedEnvValue = string | boolean | undefined;
type DerivedEnvReader = (
	ctxEnv: Record<string, unknown> | undefined,
	defaults: Record<string, unknown>,
	key: DerivedEnvKey,
) => DerivedEnvValue;

function readContextEnvValue(ctxEnv: Record<string, unknown>, key: string): unknown {
	return ctxEnv[key];
}

function readEnvValue(
	ctxEnv: Record<string, unknown> | undefined,
	defaults: Record<string, unknown>,
	key: string,
): unknown {
	if (ctxEnv) {
		const value = readContextEnvValue(ctxEnv, key);
		if (value !== undefined) return value;
	}

	const defaultValue = readContextEnvValue(defaults, key);
	if (defaultValue !== undefined) return defaultValue;

	return readContextEnvValue(ENV_DEFAULTS as Record<string, unknown>, key);
}

function readProdUrl(
	ctxEnv: Record<string, unknown> | undefined,
	defaults: Record<string, unknown>,
	_key: DerivedEnvKey,
): string | undefined {
	const domain = readEnvValue(ctxEnv, defaults, "DOMAIN");
	return typeof domain === "string" && domain ? `https://${domain}` : undefined;
}

function readDevUrl(
	ctxEnv: Record<string, unknown> | undefined,
	defaults: Record<string, unknown>,
	_key: DerivedEnvKey,
): string {
	const devHost = readEnvValue(ctxEnv, defaults, "DEV_HOST");
	const devPort = readEnvValue(ctxEnv, defaults, "DEV_PORT");
	const host = typeof devHost === "string" && devHost ? devHost : "localhost";
	const port = typeof devPort === "string" && devPort ? devPort : "5173";
	return `http://${host}:${port}`;
}

function readIsDev(ctxEnv: Record<string, unknown> | undefined, defaults: Record<string, unknown>): boolean {
	return readEnvValue(ctxEnv, defaults, "IS_DEV") === "true";
}

const DERIVED_ENV_READERS: Record<DerivedEnvKey, DerivedEnvReader> = {
	IS_DEV: (ctxEnv, defaults) => readIsDev(ctxEnv, defaults),
	PROD_URL: readProdUrl,
	DEV_URL: readDevUrl,
	BASE_URL: (ctxEnv, defaults) => {
		return readIsDev(ctxEnv, defaults)
			? readDevUrl(ctxEnv, defaults, "DEV_URL")
			: readProdUrl(ctxEnv, defaults, "PROD_URL");
	},
	LOCATION_HINT: (ctxEnv, defaults) => {
		const value = readEnvValue(ctxEnv, defaults, "LOCATION_HINT");
		return typeof value === "string" && value ? value : ENV_DEFAULTS.LOCATION_HINT;
	},
};

export function createEnv<TEnv extends Record<string, unknown> = {}>(
	defaults: CreateEnvDefaults<TEnv> = {},
): CreateEnvResult<TEnv> {
	return new Proxy({} as CreateEnvResult<TEnv>, {
		get(_target, key) {
			if (typeof key !== "string") return undefined;

			const ctxEnv = tryGetContext<AppEnv<TEnv>>()?.env as Record<string, unknown> | undefined;
			const defaultValues = defaults as Record<string, unknown>;

			if (key in DERIVED_ENV_READERS) {
				return DERIVED_ENV_READERS[key as DerivedEnvKey](
					ctxEnv,
					defaultValues,
					key as DerivedEnvKey,
				);
			}

			return readEnvValue(ctxEnv, defaultValues, key);
		},
		set(_target, key, value) {
			if (typeof key !== "string") return false;
			(getContext<AppEnv<TEnv>>().env as Record<string, unknown>)[key] = value;
			return true;
		},
	});
}
