import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import type { SQLWrapper } from "drizzle-orm";
import postgres from "postgres";
import { createEnv, type CreateEnvResult } from "../env.js";
import {
  fetchList,
  type FetchListProps,
  type FetchListResult,
  type InferQueryItem,
} from "./list.js";

type DbSchema = Record<string, unknown>;
type DbClient = ReturnType<typeof postgres>;
type StringEnvKey<TEnv extends Record<string, unknown>> = {
  [K in keyof TEnv]-?: TEnv[K] extends string | undefined ? K : never;
}[keyof TEnv];
type DbConfigEnv<TEnv extends Record<string, unknown> = {}> = CreateEnvResult<TEnv>;

export type DatabaseWithList<
  TSchema extends DbSchema,
  TEnv extends Record<string, unknown> = {},
> = PostgresJsDatabase<TSchema> & {
  fetchList<Q extends SQLWrapper, R = InferQueryItem<Q>>(
    props: Omit<FetchListProps<Q, R>, "db">,
  ): Promise<FetchListResult<R>>;
};

export type CreateDBOptions<
  TSchema extends DbSchema,
  TEnv extends Record<string, unknown> = {},
> = {
  schema: TSchema;
  DATABASE_URL_KEY: StringEnvKey<TEnv>;
};

function resolveConnection<TEnv extends Record<string, unknown>>(
  env: DbConfigEnv<TEnv>,
  envKey: StringEnvKey<TEnv>,
): string {
  const key = String(envKey);
  const values = env as unknown as Record<string, unknown>;
  const connectionString = values[key];

  if (typeof connectionString !== "string" || !connectionString) {
    throw new Error(
      `[app-kit/db] Missing database connection for key \`${key}\`.`,
    );
  }

  return connectionString;
}

function createClient(connectionString: string): DbClient {
  return postgres(connectionString, { prepare: false });
}

export function createDB<
  TEnv extends Record<string, unknown> = {},
  TSchema extends DbSchema = DbSchema,
>(options: CreateDBOptions<TSchema, TEnv>): DatabaseWithList<TSchema, TEnv> {
  const cache = new Map<string, PostgresJsDatabase<TSchema>>();
  const env = createEnv<TEnv>();

  const getDb = () => {
    const connectionString = resolveConnection(env, options.DATABASE_URL_KEY);
    const cached = cache.get(connectionString);
    if (cached) return cached;

    const client = createClient(connectionString);
    const db = drizzle(client, { schema: options.schema });
    cache.set(connectionString, db);
    return db;
  };

  const target = Object.assign(
    {},
    {
      fetchList<Q extends SQLWrapper, R = InferQueryItem<Q>>(
        props: Omit<FetchListProps<Q, R>, "db">,
      ) {
        return fetchList({
          db: getDb(),
          ...props,
        });
      },
    },
  );

  return new Proxy(target as DatabaseWithList<TSchema, TEnv>, {
    get(_target, property, receiver) {
      if (Reflect.has(target, property))
        return Reflect.get(target, property, receiver);
      return Reflect.get(getDb(), property, receiver);
    },
  });
}
