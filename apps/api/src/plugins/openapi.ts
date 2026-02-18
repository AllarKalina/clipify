import { openapi } from "@elysiajs/openapi";
import type { AppEnv } from "../config/env";

export function createOpenApiPlugin(env: AppEnv) {
  return openapi({
    documentation: {
      info: {
        title: env.APP_NAME,
        version: "0.1.0"
      }
    },
    provider: env.NODE_ENV === "production" ? null : "scalar",
    path: "/openapi",
    specPath: "/openapi/json"
  });
}
