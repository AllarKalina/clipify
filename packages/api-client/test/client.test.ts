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

  test("signs up with email/password and returns persisted session cookie value", async () => {
    const client = createApiClient({
      baseUrl: "https://example.com",
      fetchImpl: async () =>
        new Response(
          JSON.stringify({
            user: { id: "user-1", email: "allar@example.com", name: "Allar" }
          }),
          {
            status: 200,
            headers: {
              "set-cookie": "better-auth.session_token=signed-up-token-123; Path=/; HttpOnly"
            }
          }
        )
    });

    const payload = await client.signUpWithEmailPassword({
      name: "Allar",
      email: "allar@example.com",
      password: "super-secret"
    });

    expect(payload.sessionCookie).toBe("better-auth.session_token=signed-up-token-123");
  });

  test("signs out with the persisted session cookie", async () => {
    let requestedUrl = "";
    let method = "";
    let cookieHeader = "";
    let originHeader = "";
    const client = createApiClient({
      baseUrl: "https://example.com",
      sessionCookie: "better-auth.session_token=abc123",
      fetchImpl: async (url, init) => {
        requestedUrl = String(url);
        method = init?.method ?? "GET";
        cookieHeader = new Headers(init?.headers).get("cookie") ?? "";
        originHeader = new Headers(init?.headers).get("origin") ?? "";
        return Response.json({ success: true });
      }
    });

    await client.signOut();

    expect(requestedUrl).toContain("/api/auth/sign-out");
    expect(method).toBe("POST");
    expect(cookieHeader).toBe("better-auth.session_token=abc123");
    expect(originHeader).toBe("https://example.com");
  });

  test("returns cli auth status for authenticated user", async () => {
    let requestedUrl = "";
    let cookieHeader = "";
    const client = createApiClient({
      baseUrl: "https://example.com",
      sessionCookie: "better-auth.session_token=abc123",
      fetchImpl: async (url, init) => {
        requestedUrl = String(url);
        cookieHeader = new Headers(init?.headers).get("cookie") ?? "";
        return Response.json({
          linked: true,
          relinkRequired: false
        });
      }
    });

    const payload = await client.getCliAuthorizationStatus();

    expect(payload.linked).toBeTrue();
    expect(payload.relinkRequired).toBeFalse();
    expect(requestedUrl).toContain("/v1/cli/auth/status");
    expect(cookieHeader).toBe("better-auth.session_token=abc123");
  });

  test("returns cli bootstrap payload for authenticated user", async () => {
    let requestedUrl = "";
    const client = createApiClient({
      baseUrl: "https://example.com",
      sessionCookie: "better-auth.session_token=abc123",
      fetchImpl: async (url) => {
        requestedUrl = String(url);
        return Response.json({
          home: {
            spotify: "linked",
            userName: "Allar",
            userEmail: "allar@example.com",
            spotifyDisplayName: "Allar",
            deviceId: "device-1",
            deviceName: "MacBook Pro",
            deviceType: "Computer",
            deviceStatus: "active",
            supportsVolume: true,
            volumePercent: 60,
            playbackState: "playing",
            shuffleEnabled: false,
            repeatMode: "off",
            trackName: "Dreams",
            artistName: "Fleetwood Mac",
            albumName: "Rumours",
            progressMs: 120000,
            durationMs: 257000,
            queueStatus: "ready",
            queue: [],
            recentUnavailable: false,
            recent: [],
            linked: true,
            relinkRequired: false,
            profile: {
              id: "spotify-user-1",
              displayName: "Allar",
              email: "allar@spotify.test",
              profileUrl: "https://open.spotify.com/user/allar",
              imageUrl: "https://i.scdn.co/image/avatar-1"
            }
          },
          browse: {
            featuredPlaylists: [],
            playlists: [],
            likedTracks: []
          },
          warning: ""
        });
      }
    });

    const payload = await client.getCliBootstrap();
    expect(payload.home.spotify).toBe("linked");
    expect(requestedUrl).toContain("/v1/cli/bootstrap");
  });

  test("returns cli search payload for authenticated user", async () => {
    let requestedUrl = "";
    const client = createApiClient({
      baseUrl: "https://example.com",
      sessionCookie: "better-auth.session_token=abc123",
      fetchImpl: async (url) => {
        requestedUrl = String(url);
        return Response.json({
          tracks: [],
          playlists: [],
          albums: [
            {
              id: "album-1",
              name: "Rumours",
              artistName: "Fleetwood Mac",
              imageUrl: "",
              uri: "spotify:album:1"
            }
          ],
          artists: []
        });
      }
    });

    const payload = await client.searchCli("rumours");

    expect(payload.albums[0]?.name).toBe("Rumours");
    expect(requestedUrl).toContain("/v1/cli/search");
    expect(requestedUrl).toContain("q=rumours");
  });

  test("returns cli player snapshot payload for authenticated user", async () => {
    let requestedUrl = "";
    const client = createApiClient({
      baseUrl: "https://example.com",
      sessionCookie: "better-auth.session_token=abc123",
      fetchImpl: async (url) => {
        requestedUrl = String(url);
        return Response.json({
          home: {
            spotify: "linked",
            userName: "Allar",
            userEmail: "allar@example.com",
            spotifyDisplayName: "Allar",
            deviceId: "device-1",
            deviceName: "MacBook Pro",
            deviceType: "Computer",
            deviceStatus: "active",
            supportsVolume: true,
            volumePercent: 60,
            playbackState: "playing",
            shuffleEnabled: false,
            repeatMode: "off",
            trackName: "Dreams",
            artistName: "Fleetwood Mac",
            albumName: "Rumours",
            progressMs: 120000,
            durationMs: 257000,
            queueStatus: "ready",
            queue: [],
            recentUnavailable: false,
            recent: [],
            linked: true,
            relinkRequired: false,
            profile: null
          },
          warning: ""
        });
      }
    });

    const payload = await client.getCliPlayerSnapshot();
    expect(payload.home.spotify).toBe("linked");
    expect(requestedUrl).toContain("/v1/cli/player/snapshot");
  });

  test("posts normalized cli player action payload", async () => {
    const calls: Array<{ url: string; method: string; contentType: string; body: string }> = [];
    const client = createApiClient({
      baseUrl: "https://example.com",
      sessionCookie: "better-auth.session_token=abc123",
      fetchImpl: async (url, init) => {
        calls.push({
          url: String(url),
          method: init?.method ?? "GET",
          contentType: new Headers(init?.headers).get("content-type") ?? "",
          body: String(init?.body ?? "")
        });
        return Response.json({ ok: true, action: "play-context" });
      }
    });

    const payload = await client.runCliPlayerAction({
      action: "play-context",
      contextUri: "spotify:playlist:1"
    });

    expect(payload.action).toBe("play-context");
    expect(calls[0]?.url).toBe("https://example.com/v1/cli/player/action");
    expect(calls[0]?.method).toBe("POST");
    expect(calls[0]?.contentType).toBe("application/json");
    expect(calls[0]?.body).toContain("\"action\":\"play-context\"");
  });

  test("throws when protected route is called without session cookie", async () => {
    const client = createApiClient({
      baseUrl: "https://example.com",
      fetchImpl: async () => Response.json({})
    });

    expect(client.getCliBootstrap()).rejects.toBeInstanceOf(ApiClientError);
  });

  test("retries once on transient GET network failure", async () => {
    let callCount = 0;
    const client = createApiClient({
      baseUrl: "https://example.com",
      fetchImpl: async () => {
        callCount += 1;
        if (callCount === 1) {
          throw new TypeError("Unable to connect. Is the computer able to access the url?");
        }

        return Response.json({
          appName: "clipify-api",
          apiVersion: "v1",
          minCliVersion: "0.1.0",
          latestCliVersion: "0.1.0"
        });
      }
    });

    const payload = await client.getVersion();
    expect(payload.apiVersion).toBe("v1");
    expect(callCount).toBe(2);
  });

  test("encodes library id when fetching library view", async () => {
    let requestedUrl = "";
    const client = createApiClient({
      baseUrl: "https://example.com",
      sessionCookie: "better-auth.session_token=abc123",
      fetchImpl: async (url) => {
        requestedUrl = String(url);
        return Response.json({ section: null });
      }
    });

    await client.getCliLibraryView("spotify:playlist:abc/def");

    expect(requestedUrl).toContain("/v1/cli/view/library/spotify%3Aplaylist%3Aabc%2Fdef");
  });

  test("throws when sign-out is called without session cookie", async () => {
    const client = createApiClient({
      baseUrl: "https://example.com",
      fetchImpl: async () => Response.json({ success: true })
    });

    await expect(client.signOut()).rejects.toBeInstanceOf(ApiClientError);
  });
});
