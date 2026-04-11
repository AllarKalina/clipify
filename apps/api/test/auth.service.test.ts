import { describe, expect, test } from "bun:test";
import type { AppEnv } from "../src/config/env";
import { createDb } from "../src/db/client";
import {
  buildTrustedOrigins,
  createAuth,
  getAuthOpenApiPaths,
  waitForAuthOpenApiSchema
} from "../src/modules/auth/service";

describe("auth service", () => {
  test("includes loopback aliases for localhost auth url", () => {
    const origins = buildTrustedOrigins("http://localhost:3000");

    expect(origins).toContain("http://localhost:3000");
    expect(origins).toContain("http://127.0.0.1:3000");
    expect(origins).toContain("http://[::1]:3000");
  });

  test("keeps non-loopback auth url unchanged", () => {
    const origins = buildTrustedOrigins("https://clipify.example.com");

    expect(origins).toEqual(["https://clipify.example.com"]);
  });

  test("loads Better Auth OpenAPI paths under /api/auth prefix", async () => {
    const env: AppEnv = {
      API_VERSION: "v1",
      APP_NAME: "clipify-api",
      BETTER_AUTH_SECRET: "super-secret-value-123456789012345678901234",
      BETTER_AUTH_URL: "http://localhost:3000",
      DATABASE_URL: "postgres://postgres:postgres@127.0.0.1:5432/clipify",
      HOST: "127.0.0.1",
      LATEST_CLI_VERSION: "0.1.0",
      LOG_LEVEL: "error",
      MIN_CLI_VERSION: "0.1.0",
      NODE_ENV: "test",
      OTEL_ENABLED: false,
      OTEL_EXPORTER_OTLP_ENDPOINT: "https://otel.example.com/v1/traces",
      OTEL_EXPORTER_OTLP_HEADERS: "",
      OTEL_SERVICE_NAME: "clipify-api",
      PORT: 3000
    };
    const { db, sql } = createDb(env);

    createAuth(env, db);
    await waitForAuthOpenApiSchema();

    const authPathKeys = Object.keys(getAuthOpenApiPaths());
    expect(authPathKeys.length).toBeGreaterThan(3);
    expect(authPathKeys).toContain("/api/auth/get-session");
    expect(authPathKeys).toContain("/api/auth/sign-in/email");

    await sql.end({ timeout: 0 });
  });
});
