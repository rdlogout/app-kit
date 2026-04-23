import {
	and,
	asc,
	desc,
	eq,
	gt,
	gte,
	ilike,
	inArray,
	isNull,
	like,
	lt,
	lte,
	or,
	type Column,
	type SQL,
	type SQLWrapper,
} from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { z } from "zod";

type DatabaseLike = Pick<PostgresJsDatabase<Record<string, never>>, "select">;

export type OrderByDirection = "asc" | "desc";
export type ListFilterMode = "eq" | "like" | "ilike" | "gt" | "gte" | "lt" | "lte" | "in" | "isNull";
export type DbListFilter = [key: string, mode: ListFilterMode, value: unknown];
export type DbListSort = [key: string, dir: OrderByDirection];
export type DbListInput = {
	cursor?: string;
	filters?: DbListFilter[];
	sort?: DbListSort;
};

export type DbListFilterConfig = {
	modes: readonly ListFilterMode[];
	column?: Column | null;
	build?: (mode: ListFilterMode, value: unknown) => SQL | undefined;
};

export type DbListSortConfig =
	| Column
	| {
			column: Column;
			valueKey?: string;
	  };

export type DbListCursorConfig = {
	key: string;
	column: Column;
};

const listFilterModeSchema = z.enum(["eq", "like", "ilike", "gt", "gte", "lt", "lte", "in", "isNull"]);

const parseJsonParam = (value: unknown) => {
	if (typeof value !== "string") return value;

	try {
		return JSON.parse(value);
	} catch {
		return value;
	}
};

export function extendDbListSchema<T extends z.ZodRawShape = z.ZodRawShape>(shape?: T) {
	const base = z.object({
		cursor: z.string().optional(),
		filters: z.preprocess(
			parseJsonParam,
			z.array(z.tuple([z.string().min(1), listFilterModeSchema, z.unknown()])),
		).optional(),
		sort: z.preprocess(parseJsonParam, z.tuple([z.string().min(1), z.enum(["asc", "desc"])]))
			.optional(),
	});

	return base.extend((shape ?? {}) as T).optional();
}

export type InferQueryItem<Q extends SQLWrapper> = Q extends {
	limit: (limit: number) => { offset: (offset: number) => Promise<infer Rows> };
}
	? Rows extends Array<infer Item>
		? Item
		: unknown
	: unknown;

export type FetchListProps<Q extends SQLWrapper, R = InferQueryItem<Q>> = {
	db: DatabaseLike;
	query: Q;
	where?: SQL | SQL[];
	input?: DbListInput | null;
	limit?: number;
	pagination?: "cursor" | "none";
	allowedFilters?: readonly string[];
	allowedSorts?: readonly string[];
	filterKeyMap?: Record<string, DbListFilterConfig>;
	sortKeyMap?: Record<string, DbListSortConfig>;
	defaultSort?: DbListSort;
	cursorKey?: DbListCursorConfig;
	transform?: (item: InferQueryItem<Q>) => R | Promise<R>;
};

export type FetchListResult<R> = {
	items: R[];
	hasMore: boolean;
	cursor: string | null;
};

const DEFAULT_LIMIT = 20;

function normalizeLimit(value: number | undefined, fallback = DEFAULT_LIMIT) {
	if (!Number.isFinite(value)) return fallback;
	return Math.max(1, Math.floor(value as number));
}

function pushWhereConditions(conditions: SQL[], where?: SQL | SQL[]) {
	if (!where) return;
	if (Array.isArray(where)) {
		conditions.push(...where.filter(Boolean));
		return;
	}
	conditions.push(where);
}

function getSortConfig(config: DbListSortConfig): { column: Column; valueKey: string } {
	return "column" in config
		? { column: config.column, valueKey: config.valueKey ?? "" }
		: { column: config, valueKey: "" };
}

function getPathValue(value: unknown, path: string): unknown {
	if (!path) return value;
	const segments = path.split(".");
	let current = value;
	for (const segment of segments) {
		if (!current || typeof current !== "object") return undefined;
		current = (current as Record<string, unknown>)[segment];
	}
	return current;
}

function encodeCursor(payload: { value: unknown; id: unknown }) {
	return encodeURIComponent(JSON.stringify(payload));
}

function decodeCursor(cursor: string): { value: unknown; id: unknown } {
	try {
		const parsed = JSON.parse(decodeURIComponent(cursor)) as { value?: unknown; id?: unknown };
		if (!("id" in parsed) || !("value" in parsed)) throw new Error("Invalid cursor");
		return { value: parsed.value, id: parsed.id };
	} catch {
		throw new Error("Invalid cursor");
	}
}

function buildFilterCondition(
	config: DbListFilterConfig,
	key: string,
	mode: ListFilterMode,
	value: unknown,
): SQL | undefined {
	if (!config.modes.includes(mode)) throw new Error(`Unsupported filter mode for '${key}'`);
	if (config.build) return config.build(mode, value);
	if (config.column == null) throw new Error(`Filter '${key}' is not configured`);

	if (mode === "isNull") return value ? isNull(config.column) : undefined;
	if (value === undefined || value === null || value === "") return undefined;

	switch (mode) {
		case "eq":
			return eq(config.column, value);
		case "like":
			return like(config.column, `%${String(value)}%`);
		case "ilike":
			return ilike(config.column, `%${String(value)}%`);
		case "gt":
			return gt(config.column, value);
		case "gte":
			return gte(config.column, value);
		case "lt":
			return lt(config.column, value);
		case "lte":
			return lte(config.column, value);
		case "in": {
			const values = Array.isArray(value) ? value : [value];
			return values.length > 0 ? inArray(config.column, values) : undefined;
		}
	}

	return undefined;
}

function applyWhere<Q extends SQLWrapper>(query: Q, condition?: SQL): SQLWrapper {
	if (!condition) return query;
	const queryBuilder = query as unknown as { where?: (where: SQL) => SQLWrapper };
	return queryBuilder.where ? queryBuilder.where(condition) : query;
}

function applyOrder(query: SQLWrapper, orderClauses: SQL[]) {
	if (orderClauses.length === 0) return query;
	const queryBuilder = query as unknown as { orderBy?: (...columns: SQL[]) => SQLWrapper };
	return queryBuilder.orderBy ? queryBuilder.orderBy(...orderClauses) : query;
}

async function runLimitedQuery<Q extends SQLWrapper>(query: SQLWrapper, limit: number): Promise<InferQueryItem<Q>[]> {
	const queryBuilder = query as unknown as { limit?: (limit: number) => { offset: (offset: number) => Promise<unknown[]> } };
	if (!queryBuilder.limit) throw new Error("fetchList query does not support limit/offset");
	return queryBuilder.limit(limit).offset(0) as Promise<InferQueryItem<Q>[]>;
}

function createCursorCondition(sortColumn: Column, cursorColumn: Column, direction: OrderByDirection, cursor: { value: unknown; id: unknown }) {
	if (sortColumn === cursorColumn) {
		return direction === "desc" ? lt(sortColumn, cursor.value) : gt(sortColumn, cursor.value);
	}

	return direction === "desc"
		? or(lt(sortColumn, cursor.value), and(eq(sortColumn, cursor.value), lt(cursorColumn, cursor.id)))
		: or(gt(sortColumn, cursor.value), and(eq(sortColumn, cursor.value), gt(cursorColumn, cursor.id)));
}

export async function fetchList<Q extends SQLWrapper, R = InferQueryItem<Q>>(
	props: FetchListProps<Q, R>,
): Promise<FetchListResult<R>> {
	const { query, input, transform, filterKeyMap, sortKeyMap, defaultSort, cursorKey } = props;
	const pageLimit = normalizeLimit(props.limit, DEFAULT_LIMIT);
	const pagination = props.pagination ?? "cursor";
	const rawFilters = input?.filters ?? [];
	const allowedFilters = new Set(props.allowedFilters ?? Object.keys(filterKeyMap ?? {}));
	const allowedSorts = new Set(props.allowedSorts ?? Object.keys(sortKeyMap ?? {}));

	const conditions: SQL[] = [];
	pushWhereConditions(conditions, props.where);

	for (const [key, mode, value] of rawFilters) {
		if (!allowedFilters.has(key)) throw new Error(`Unsupported filter '${key}'`);
		const filterConfig = filterKeyMap?.[key];
		if (!filterConfig) throw new Error(`Unsupported filter '${key}'`);
		const condition = buildFilterCondition(filterConfig, key, mode, value);
		if (condition) conditions.push(condition);
	}

	const requestedSort = input?.sort ?? defaultSort;
	let sortColumn: Column | undefined;
	let sortValueKey = "";
	let sortDir: OrderByDirection = requestedSort?.[1] ?? defaultSort?.[1] ?? "desc";

	if (requestedSort) {
		const [sortKey, direction] = requestedSort;
		if (!allowedSorts.has(sortKey)) throw new Error(`Unsupported sort '${sortKey}'`);
		const config = sortKeyMap?.[sortKey];
		if (!config) throw new Error(`Unsupported sort '${sortKey}'`);
		const resolved = getSortConfig(config);
		sortColumn = resolved.column;
		sortValueKey = resolved.valueKey || sortKey;
		sortDir = direction;
	}

	const cursor = input?.cursor && pagination === "cursor" ? decodeCursor(input.cursor) : null;
	if (cursor && !cursorKey) throw new Error("Cursor pagination is not configured");
	if (cursor && sortColumn && cursorKey) {
		const cursorCondition = createCursorCondition(sortColumn, cursorKey.column, sortDir, cursor);
		if (cursorCondition) conditions.push(cursorCondition);
	}

	const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
	const filteredQuery = applyWhere(query, whereClause);

	const orderClauses: SQL[] = [];
	if (sortColumn) orderClauses.push(sortDir === "desc" ? desc(sortColumn) : asc(sortColumn));
	if (pagination === "cursor" && cursorKey) {
		orderClauses.push(sortDir === "desc" ? desc(cursorKey.column) : asc(cursorKey.column));
	}

	const orderedQuery = applyOrder(filteredQuery, orderClauses);
	const rawItems = await runLimitedQuery<Q>(orderedQuery, pagination === "cursor" ? pageLimit + 1 : pageLimit);
	const hasMore = pagination === "cursor" ? rawItems.length > pageLimit : false;
	const visibleItems = hasMore ? rawItems.slice(0, pageLimit) : rawItems;
	const items = transform ? await Promise.all(visibleItems.map(transform)) : (visibleItems as unknown as R[]);

	let nextCursor: string | null = null;
	if (hasMore && cursorKey && sortColumn) {
		const lastItem = visibleItems[visibleItems.length - 1] as unknown;
		nextCursor = encodeCursor({
			value: getPathValue(lastItem, sortValueKey),
			id: getPathValue(lastItem, cursorKey.key),
		});
	}

	return {
		items,
		hasMore,
		cursor: nextCursor,
	};
}
