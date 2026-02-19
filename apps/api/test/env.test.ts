import { describe, expect, test } from "bun:test";
import { readEnv } from "../src/config/env";

describe("readEnv", () => {
  test("parses valid env", () => {
    const env = readEnv({
      API_VERSION: "v1",
      APP_NAME: "clipify-api",
      BETTER_AUTH_SECRET: "super-secret-value-123",
      BETTER_AUTH_URL: "http://localhost:3000",
      DATABASE_URL: "https://example.com/db",
      HOST: "127.0.0.1",
      LATEST_CLI_VERSION: "0.1.0",
      LOG_LEVEL: "debug",
      MIN_CLI_VERSION: "0.1.0",
      NODE_ENV: "test",
      OTEL_ENABLED: "true",
      OTEL_EXPORTER_OTLP_ENDPOINT: "https://otel.example.com/v1/traces",
      PORT: "4000"
    });

    expect(env.PORT).toBe(4000);
    expect(env.NODE_ENV).toBe("test");
    expect(env.OTEL_ENABLED).toBe(true);
  });

  test("throws on invalid env", () => {
    expect(() =>
      readEnv({
        APP_NAME: "clipify-api"
      })
    ).toThrow();
  });

  test("throws when spotify redirect uri uses localhost alias", () => {
    expect(() =>
      readEnv({
        API_VERSION: "v1",
        APP_NAME: "clipify-api",
        BETTER_AUTH_SECRET: "super-secret-value-123",
        BETTER_AUTH_URL: "http://localhost:3000",
        DATABASE_URL: "https://example.com/db",
        HOST: "127.0.0.1",
        LATEST_CLI_VERSION: "0.1.0",
        LOG_LEVEL: "debug",
        MIN_CLI_VERSION: "0.1.0",
        NODE_ENV: "test",
        OTEL_ENABLED: "true",
        OTEL_EXPORTER_OTLP_ENDPOINT: "https://otel.example.com/v1/traces",
        PORT: "4000",
        SPOTIFY_REDIRECT_URI: "http://localhost:3000/v1/spotify/auth/callback/public"
      })
    ).toThrow("SPOTIFY_REDIRECT_URI must use a loopback IP literal");
  });
});
