import { Elysia, t } from "elysia";
import type { AppEnv } from "../../config/env";
import { withRequestIdHeader } from "../../plugins/openapi-headers";

export function healthModule(env: AppEnv) {
  return new Elysia({
    name: "health",
    tags: ["system"]
  }).get(
    "/health",
    () => ({
      name: env.APP_NAME,
      status: "ok",
      env: env.NODE_ENV,
      timestamp: new Date().toISOString()
    }),
    {
      detail: {
        summary: "Liveness check"
      },
      response: withRequestIdHeader(t.Object({
        name: t.String(),
        status: t.String(),
        env: t.String(),
        timestamp: t.String()
      }))
    }
  );
}
