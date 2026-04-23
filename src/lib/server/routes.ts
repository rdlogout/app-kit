import { Hono } from "hono";
import { AUTH_BASE_PATH } from "../shared/constants.js";
import type { createAuth } from "./auth/index.js";
import type { createStorage } from "./storage/index.js";
import { createAssetsRoute } from "./storage/assets.js";
import { authRequired } from "./rpc/auth.ts";
import { getConduit } from "./conduit.ts";

type AuthGetter = ReturnType<typeof createAuth>;
type StorageInstance = ReturnType<typeof createStorage>;

type AuthRoute = {
  path?: string;
  getAuth: AuthGetter;
};

type AssetsRoute<TEnv extends Record<string, unknown>> = {
  path?: string;
  storage: StorageInstance;
  imagesKey?: keyof TEnv;
};

type ConfigureRoutesOptions<TEnv extends Record<string, unknown>> = {
  conduit?: boolean;
  auth?: AuthRoute;
  assets?: AssetsRoute<TEnv>;
};

function normalizePath(path: string): string {
  const normalized = `/${path.replace(/^\/+|\/+$/g, "")}`;
  return normalized === "/" ? "" : normalized;
}

export function configureRoutes<TEnv extends Record<string, unknown> = {}>(
  options: ConfigureRoutesOptions<TEnv>,
) {
  const app = new Hono();

  if (options.conduit) {
    const path = "/api/conduit";

    app.all(`${path}/*`, async (c) => {
      const { user } = await authRequired();
      const conduit = await getConduit(user.id);
      return conduit.fetch(c.req.raw);
    });
  }

  if (options.auth) {
    const path = normalizePath(options.auth.path ?? AUTH_BASE_PATH);
    app.all(`${path}/*`, (c) => options.auth!.getAuth().handler(c.req.raw));
  }

  if (options.assets) {
    const path = normalizePath(options.assets.path ?? "/assets");
    app.get(`${path}/*`, async (c) => {
      const assetPath = decodeURIComponent(
        c.req.path.slice(path.length).replace(/^\/+/, ""),
      );
      const response = await createAssetsRoute(
        c.req.raw,
        assetPath,
        options.assets!,
      );
      return response ?? c.notFound();
    });
  }

  return app;
}
