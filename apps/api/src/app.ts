import { Elysia } from "elysia";
import type { AppEnv } from "./config/env";
import { authModule } from "./modules/auth/routes";
import type { AppAuth } from "./modules/auth/service";
import { cliBffModule } from "./modules/cli-bff/routes";
import { healthModule } from "./modules/health/routes";
import { publicModule } from "./modules/public/routes";
import { readyModule } from "./modules/ready/routes";
import type { SpotifyService } from "./modules/spotify/service";
import { userModule } from "./modules/user/routes";
import { createOpenApiPlugin } from "./plugins/openapi";
import { createOtelPlugin } from "./plugins/otel";
import { createProtectedSessionPlugin } from "./plugins/protected-session";
import { requestIdPlugin } from "./plugins/request-id";
import type { Logger } from "./plugins/logger";

export type AppDeps = {
  env: AppEnv;
  logger: Logger;
  auth: AppAuth;
  spotify: SpotifyService;
  checkReadiness: () => Promise<boolean>;
};

export function createApp(deps: AppDeps) {
  const { env, logger, auth, spotify, checkReadiness } = deps;

  const baseApp = new Elysia({ aot: env.NODE_ENV === "production" }).use(requestIdPlugin).use(createOpenApiPlugin(env));

  const otelPlugin = createOtelPlugin(env);
  const appWithPlugins = otelPlugin ? baseApp.use(otelPlugin) : baseApp;

  return appWithPlugins
    .use(createProtectedSessionPlugin(auth, "/v1/me"))
    .use(createProtectedSessionPlugin(auth, "/v1/cli"))
    .onRequest(({ request, set }) => {
      const requestId = set.headers["x-request-id"];
      logger.info("request.start", {
        requestId,
        method: request.method,
        path: new URL(request.url).pathname
      });
    })
    .onAfterResponse(({ request, set }) => {
      const requestId = set.headers["x-request-id"];
      logger.info("request.done", {
        requestId,
        method: request.method,
        path: new URL(request.url).pathname,
        status: set.status || 200
      });
    })
    .onError(({ code, error, request, set }) => {
      const requestId = set.headers["x-request-id"];
      const path = new URL(request.url).pathname;

      if (code === "VALIDATION" && path.startsWith("/v1/cli")) {
        set.status = 400;
        return {
          error: {
            code: "INVALID_INPUT",
            message: "Invalid request."
          }
        };
      }

      if (error instanceof Response) {
        return;
      }

      logger.error("request.error", {
        requestId,
        method: request.method,
        path,
        code,
        message: error instanceof Error ? error.message : String(error)
      });
    })
    .use(authModule(auth))
    .use(publicModule(env))
    .use(healthModule(env))
    .use(readyModule(checkReadiness))
    .use(cliBffModule(auth, spotify))
    .use(userModule(auth));
}
