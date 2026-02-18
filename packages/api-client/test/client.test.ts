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

  test("throws when protected route is called without session cookie", async () => {
    const client = createApiClient({
      baseUrl: "https://example.com",
      fetchImpl: async () => Response.json({})
    });

    expect(client.getSpotifyCurrentlyPlaying()).rejects.toBeInstanceOf(ApiClientError);
  });
});
