import { describe, expect, test } from "bun:test";
import { createApp } from "../src/app";
import type { AppEnv } from "../src/config/env";
import { createLogger } from "../src/plugins/logger";

function baseEnv(): AppEnv {
  return {
    API_VERSION: "v1",
    APP_NAME: "clipify-api",
    BETTER_AUTH_SECRET: "super-secret-value-123",
    BETTER_AUTH_URL: "http://localhost:3000",
    DATABASE_URL: "https://example.com/db",
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
}

function createAuthMock() {
  return {
    api: {
      async getSession() {
        return null;
      },
      async signInEmail(context: { headers: Headers; body: Record<string, unknown>; asResponse?: boolean }) {
        return {
          headers: new Headers({
            "set-cookie": "better-auth.session_token=signed-token-123; Path=/; HttpOnly"
          }),
          response: {
            redirect: false,
            token: "token-1",
            user: {
              id: "u_123",
              email: String(context.body.email ?? ""),
              name: "Allar",
              emailVerified: true,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            }
          },
          status: 200
        };
      },
      async signUpEmail(context: { headers: Headers; body: Record<string, unknown>; asResponse?: boolean }) {
        return {
          headers: new Headers({
            "set-cookie": "better-auth.session_token=signed-up-token-123; Path=/; HttpOnly"
          }),
          response: {
            token: "token-1",
            user: {
              id: "u_123",
              email: String(context.body.email ?? ""),
              name: String(context.body.name ?? ""),
              emailVerified: false,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            }
          },
          status: 200
        };
      },
      async signOut() {
        return {
          headers: new Headers(),
          response: { success: true },
          status: 200
        };
      }
    }
  };
}

function createSpotifyMock() {
  return {
    isConfigured() {
      return true;
    }
  };
}

describe("auth routes", () => {
  test("sign-up endpoint preserves auth cookies", async () => {
    const env = baseEnv();
    const app = createApp({
      env,
      logger: createLogger(env),
      auth: createAuthMock() as never,
      spotify: createSpotifyMock() as never,
      checkReadiness: async () => true
    });

    const response = await app.handle(
      new Request("http://localhost/api/auth/sign-up/email", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          name: "Allar",
          email: "allar@example.com",
          password: "secret"
        })
      })
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("set-cookie")).toContain("better-auth.session_token=signed-up-token-123");
  });

  test("sign-out endpoint stays available as explicit route", async () => {
    const env = baseEnv();
    const app = createApp({
      env,
      logger: createLogger(env),
      auth: createAuthMock() as never,
      spotify: createSpotifyMock() as never,
      checkReadiness: async () => true
    });

    const response = await app.handle(
      new Request("http://localhost/api/auth/sign-out", {
        method: "POST"
      })
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true });
  });
});
