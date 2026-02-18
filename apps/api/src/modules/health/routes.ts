import { Elysia, t } from "elysia";
import type { AppEnv } from "../../config/env";

export function healthModule(env: AppEnv) {
  return new Elysia({ name: "health" }).get(
    "/health",
    () => ({
      name: env.APP_NAME,
      status: "ok",
      env: env.NODE_ENV,
      timestamp: new Date().toISOString()
    }),
    {
      detail: {
        tags: ["system"],
        summary: "Liveness check"
      },
      response: t.Object({
        name: t.String(),
        status: t.String(),
        env: t.String(),
        timestamp: t.String()
      })
    }
  );
}
