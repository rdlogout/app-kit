import type { Context as HonoContext } from "hono";
import { getContext, tryGetContext } from "./runtime.js";

const HONO_CONTEXT_KEY = "__app_kit_hono_context";
const SET_COOKIE_KEY = "__app_kit_set_cookie";

type HeadersWithSetCookie = Headers & {
	getSetCookie?: () => string[];
};

export function setHonoContext(context: HonoContext): void {
	getContext().set(HONO_CONTEXT_KEY, context);
}

export function getHonoContext(): HonoContext | undefined {
	return tryGetContext()?.get<HonoContext>(HONO_CONTEXT_KEY);
}

export function queueSetCookie(cookie: string): void {
	if (!cookie) return;
	const ctx = tryGetContext();
	if (!ctx) return;

	const current = ctx.get<string[]>(SET_COOKIE_KEY) ?? [];
	ctx.set(SET_COOKIE_KEY, [...current, cookie]);
}

export function consumeSetCookies(): string[] {
	const ctx = tryGetContext();
	if (!ctx) return [];

	const cookies = ctx.get<string[]>(SET_COOKIE_KEY) ?? [];
	ctx.set(SET_COOKIE_KEY, []);
	return cookies;
}

export function readSetCookieHeaders(headers: Headers): string[] {
	const values = (headers as HeadersWithSetCookie).getSetCookie?.() ?? [];
	if (values.length > 0) return values;

	const single = headers.get("set-cookie");
	return single ? [single] : [];
}
