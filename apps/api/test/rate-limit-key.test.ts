import { describe, expect, test } from "bun:test";
import { buildRateLimitKey } from "../src/plugins/rate-limit-key";

describe("buildRateLimitKey", () => {
  test("uses hashed session cookie when available for search scope", () => {
    const request = new Request("http://localhost/v1/cli/search?q=hello", {
      headers: {
        cookie: "better-auth.session_token=session-123; Path=/; HttpOnly"
      }
    });

    const key = buildRateLimitKey(request, {
      scope: "search",
      allowSessionCookie: true
    });

    expect(key).toStartWith("search:session:");
  });

  test("ignores forwarded ip headers unless trusted proxy mode is enabled", () => {
    const request = new Request("http://localhost/api/auth/sign-in/email", {
      headers: {
        "x-forwarded-for": "203.0.113.25",
        "x-real-ip": "198.51.100.24"
      }
    });

    const key = buildRateLimitKey(request, {
      scope: "auth",
      trustProxyHeaders: false
    });

    expect(key).toBe("auth:global:localhost");
  });

  test("uses forwarded ip in trusted proxy mode", () => {
    const request = new Request("http://localhost/api/auth/sign-in/email", {
      headers: {
        "x-forwarded-for": "203.0.113.25, 198.51.100.24"
      }
    });

    const key = buildRateLimitKey(request, {
      scope: "auth",
      trustProxyHeaders: true
    });

    expect(key).toBe("auth:ip:203.0.113.25");
  });
});
