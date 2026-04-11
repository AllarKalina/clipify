import { opentelemetry } from "@elysiajs/opentelemetry";
import type { AppEnv } from "../config/env";

export function createOtelPlugin(env: AppEnv) {
  if (!env.OTEL_ENABLED) {
    return null;
  }

  return opentelemetry({
    serviceName: env.OTEL_SERVICE_NAME ?? env.APP_NAME
  });
}
