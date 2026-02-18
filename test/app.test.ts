import { describe, expect, test } from "bun:test";
import { createApp } from "../src/app";
import type { AppEnv } from "../src/config/env";
import { createLogger } from "../src/plugins/logger";

function baseEnv(nodeEnv: AppEnv["NODE_ENV"] = "test"): AppEnv {
  return {
    APP_NAME: "bun-backend-template",
    BETTER_AUTH_SECRET: "super-secret-value-123",
    BETTER_AUTH_URL: "http://localhost:3000",
    DATABASE_URL: "https://example.com/db",
    HOST: "127.0.0.1",
    LOG_LEVEL: "error",
    NODE_ENV: nodeEnv,
    OTEL_ENABLED: false,
    OTEL_EXPORTER_OTLP_ENDPOINT: "https://otel.example.com/v1/traces",
    OTEL_EXPORTER_OTLP_HEADERS: "",
    OTEL_SERVICE_NAME: "bun-backend-template",
    PORT: 3000
  };
}

function createAuthMock(user: { id: string; email: string; name: string } | null) {
  return {
    handler() {
      return new Response("auth", { status: 200 });
    },
    api: {
      async getSession() {
        if (!user) {
          return null;
        }

        return { user };
      }
    }
  };
}

describe("app routes", () => {
  test("returns public hard-coded payload", async () => {
    const env = baseEnv();

    const app = createApp({
      env,
      logger: createLogger(env),
      auth: createAuthMock(null) as never,
      checkReadiness: async () => true
    });

    const response = await app.handle(new Request("http://localhost/v1/public/example"));
    expect(response.status).toBe(200);

    const body = (await response.json()) as { id: string; title: string; category: string };
    expect(body.id).toBe("example-1");
    expect(body.title).toBe("Public Example");
    expect(body.category).toBe("demo");
  });

  test("returns health payload", async () => {
    const env = baseEnv();

    const app = createApp({
      env,
      logger: createLogger(env),
      auth: createAuthMock(null) as never,
      checkReadiness: async () => true
    });

    const response = await app.handle(new Request("http://localhost/health"));
    expect(response.status).toBe(200);

    const body = (await response.json()) as { name: string; status: string };
    expect(body.name).toBe("bun-backend-template");
    expect(body.status).toBe("ok");
    expect(response.headers.get("x-request-id")).toBeString();
  });

  test("returns ready when dependency check succeeds", async () => {
    const env = baseEnv();

    const app = createApp({
      env,
      logger: createLogger(env),
      auth: createAuthMock(null) as never,
      checkReadiness: async () => true
    });

    const response = await app.handle(new Request("http://localhost/ready"));
    expect(response.status).toBe(200);
  });

  test("returns 503 when dependency check fails", async () => {
    const env = baseEnv();

    const app = createApp({
      env,
      logger: createLogger(env),
      auth: createAuthMock(null) as never,
      checkReadiness: async () => false
    });

    const response = await app.handle(new Request("http://localhost/ready"));
    expect(response.status).toBe(503);
  });

  test("blocks protected route without session", async () => {
    const env = baseEnv();

    const app = createApp({
      env,
      logger: createLogger(env),
      auth: createAuthMock(null) as never,
      checkReadiness: async () => true
    });

    const response = await app.handle(new Request("http://localhost/v1/me"));
    expect(response.status).toBe(401);
  });

  test("returns protected profile with session", async () => {
    const env = baseEnv();

    const app = createApp({
      env,
      logger: createLogger(env),
      auth: createAuthMock({
        id: "u_123",
        email: "a@example.com",
        name: "Allar"
      }) as never,
      checkReadiness: async () => true
    });

    const response = await app.handle(new Request("http://localhost/v1/me"));
    expect(response.status).toBe(200);

    const body = (await response.json()) as { user: { id: string } };
    expect(body.user.id).toBe("u_123");
  });

  test("keeps openapi json route available in production", async () => {
    const env = baseEnv("production");

    const app = createApp({
      env,
      logger: createLogger(env),
      auth: createAuthMock(null) as never,
      checkReadiness: async () => true
    });

    const response = await app.handle(new Request("http://localhost/openapi/json"));
    expect(response.status).toBe(200);
  });

  test("blocks openapi ui in production", async () => {
    const env = baseEnv("production");

    const app = createApp({
      env,
      logger: createLogger(env),
      auth: createAuthMock(null) as never,
      checkReadiness: async () => true
    });

    const response = await app.handle(new Request("http://localhost/openapi"));
    expect(response.status).toBe(404);
  });
});
