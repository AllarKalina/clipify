import { describe, expect, test } from "bun:test";
import { ApiClientError, createApiClient } from "../src/client";

describe("api client", () => {
  test("returns parsed version metadata", async () => {
    const client = createApiClient({
      baseUrl: "https://example.com",
      fetchImpl: async () =>
        new Response(
          JSON.stringify({
            appName: "clipify-api",
            apiVersion: "v1",
            minCliVersion: "0.1.0",
            latestCliVersion: "0.1.0"
          })
        )
    });

    const payload = await client.getVersion();
    expect(payload.apiVersion).toBe("v1");
  });

  test("throws on non-2xx response", async () => {
    const client = createApiClient({
      baseUrl: "https://example.com",
      fetchImpl: async () => new Response("nope", { status: 503 })
    });

    expect(client.getVersion()).rejects.toBeInstanceOf(ApiClientError);
  });

  test("sends cookie header for protected spotify routes", async () => {
    let cookieHeader = "";
    const client = createApiClient({
      baseUrl: "https://example.com",
      sessionCookie: "better-auth.session_token=abc123",
      fetchImpl: async (_url, init) => {
        cookieHeader = new Headers(init?.headers).get("cookie") ?? "";
        return Response.json({
          authorizeUrl: "https://accounts.spotify.com/authorize?state=abc",
          state: "abc"
        });
      }
    });

    const payload = await client.startSpotifyAuthorization();
    expect(payload.state).toBe("abc");
    expect(cookieHeader).toBe("better-auth.session_token=abc123");
  });

  test("returns current user profile for protected me route", async () => {
    const client = createApiClient({
      baseUrl: "https://example.com",
      sessionCookie: "better-auth.session_token=abc123",
      fetchImpl: async () =>
        Response.json({
          user: {
            id: "user-1",
            email: "allar@example.com",
            name: "Allar"
          }
        })
    });

    const payload = await client.getMe();
    expect(payload.user.id).toBe("user-1");
  });

  test("signs in with email/password and returns persisted session cookie value", async () => {
    const client = createApiClient({
      baseUrl: "https://example.com",
      fetchImpl: async () =>
        new Response(
          JSON.stringify({
            redirect: false,
            token: "token-1",
            user: { id: "user-1", email: "allar@example.com", name: "Allar" }
          }),
          {
            status: 200,
            headers: {
              "set-cookie": "better-auth.session_token=signed-token-123; Path=/; HttpOnly"
            }
          }
        )
    });

    const payload = await client.signInWithEmailPassword({
      email: "allar@example.com",
      password: "super-secret"
    });

    expect(payload.sessionCookie).toBe("better-auth.session_token=signed-token-123");
  });

  test("builds callback query parameters", async () => {
    let requestedUrl = "";
    const client = createApiClient({
      baseUrl: "https://example.com",
      sessionCookie: "better-auth.session_token=abc123",
      fetchImpl: async (url) => {
        requestedUrl = String(url);
        return Response.json({
          linked: true,
          userId: "user-1"
        });
      }
    });

    const payload = await client.completeSpotifyAuthorization({
      code: "code-1",
      state: "state-1"
    });

    expect(payload.linked).toBeTrue();
    expect(requestedUrl).toContain("/v1/spotify/auth/callback");
    expect(requestedUrl).toContain("code=code-1");
    expect(requestedUrl).toContain("state=state-1");
  });

  test("returns spotify authorization status for authenticated user", async () => {
    let requestedUrl = "";
    let cookieHeader = "";
    const client = createApiClient({
      baseUrl: "https://example.com",
      sessionCookie: "better-auth.session_token=abc123",
      fetchImpl: async (url, init) => {
        requestedUrl = String(url);
        cookieHeader = new Headers(init?.headers).get("cookie") ?? "";
        return Response.json({
          linked: true
        });
      }
    });

    const payload = await client.getSpotifyAuthorizationStatus();

    expect(payload.linked).toBeTrue();
    expect(requestedUrl).toContain("/v1/spotify/auth/status");
    expect(cookieHeader).toBe("better-auth.session_token=abc123");
  });

  test("throws when protected route is called without session cookie", async () => {
    const client = createApiClient({
      baseUrl: "https://example.com",
      fetchImpl: async () => Response.json({})
    });

    expect(client.getSpotifyCurrentlyPlaying()).rejects.toBeInstanceOf(ApiClientError);
  });

  test("throws when sign-in response does not include session cookie", async () => {
    const client = createApiClient({
      baseUrl: "https://example.com",
      fetchImpl: async () =>
        Response.json({
          redirect: false,
          token: "token-1"
        })
    });

    await expect(
      client.signInWithEmailPassword({
        email: "allar@example.com",
        password: "super-secret"
      })
    ).rejects.toBeInstanceOf(ApiClientError);
  });
});
