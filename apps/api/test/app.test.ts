import { describe, expect, test } from "bun:test";
import { createApp } from "../src/app";
import type { AppEnv } from "../src/config/env";
import { createLogger } from "../src/plugins/logger";

function baseEnv(nodeEnv: AppEnv["NODE_ENV"] = "test"): AppEnv {
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
    NODE_ENV: nodeEnv,
    OTEL_ENABLED: false,
    OTEL_EXPORTER_OTLP_ENDPOINT: "https://otel.example.com/v1/traces",
    OTEL_EXPORTER_OTLP_HEADERS: "",
    OTEL_SERVICE_NAME: "clipify-api",
    PORT: 3000
  };
}

function createAuthMock(
  user: { id: string; email: string; name: string } | null,
  endpointHandler?: (request: Request) => Promise<{
    headers: Headers;
    response: unknown;
    status: number;
  }> | {
    headers: Headers;
    response: unknown;
    status: number;
  }
) {
  const authUser = {
    id: user?.id ?? "u_123",
    email: user?.email ?? "a@example.com",
    name: user?.name ?? "Allar",
    emailVerified: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  async function handleEndpoint(
    request: Request,
    fallback: {
      headers: Headers;
      response: unknown;
      status: number;
    }
  ) {
    if (endpointHandler) {
      return endpointHandler(request);
    }

    return fallback;
  }

  return {
    api: {
      async getSession() {
        if (!user) {
          return null;
        }

        return { user };
      },
      async signInEmail(context: { body: unknown; headers: Headers; asResponse?: boolean }) {
        const request = new Request("http://localhost/api/auth/sign-in/email", {
          method: "POST",
          headers: context.headers,
          body: JSON.stringify(context.body)
        });

        return handleEndpoint(
          request,
          {
            headers: new Headers({
              "set-cookie": "better-auth.session_token=signed-token-123; Path=/; HttpOnly"
            }),
            response: {
              redirect: false,
              token: "token-1",
              user: authUser
            },
            status: 200
          }
        );
      },
      async signUpEmail(context: { body: unknown; headers: Headers; asResponse?: boolean }) {
        const request = new Request("http://localhost/api/auth/sign-up/email", {
          method: "POST",
          headers: context.headers,
          body: JSON.stringify(context.body)
        });

        return handleEndpoint(
          request,
          {
            headers: new Headers({
              "set-cookie": "better-auth.session_token=signed-token-123; Path=/; HttpOnly"
            }),
            response: {
              token: "token-1",
              user: authUser
            },
            status: 200
          }
        );
      },
      async signOut(context: { headers: Headers; asResponse?: boolean }) {
        const request = new Request("http://localhost/api/auth/sign-out", {
          method: "POST",
          headers: context.headers
        });

        return handleEndpoint(request, {
          headers: new Headers(),
          response: { success: true },
          status: 200
        });
      }
    }
  };
}

function createSpotifyMock() {
  return {
    isConfigured() {
      return true;
    },
    startAuthorization() {
      return {
        authorizeUrl: "https://accounts.spotify.com/authorize?state=abc",
        state: "abc"
      };
    },
    async completeAuthorization(userId: string) {
      return {
        linked: true,
        userId
      };
    },
    async completeAuthorizationFromCallback() {
      return {
        linked: true,
        userId: "u_123"
      };
    },
    async getAuthorizationStatus() {
      return {
        linked: true,
        relinkRequired: false
      };
    },
    async getCurrentlyPlaying() {
      return {
        playbackState: "playing",
        isPlaying: true,
        trackName: "Dreams",
        artistName: "Fleetwood Mac",
        albumName: "Rumours",
        albumImageUrl: "https://i.scdn.co/image/rumours",
        deviceId: "device-1",
        deviceName: "MacBook Pro",
        deviceType: "Computer",
        deviceStatus: "active",
        supportsVolume: true,
        volumePercent: 60,
        shuffleEnabled: false,
        repeatMode: "off",
        progressMs: 120000,
        durationMs: 257000
      };
    },
    async getDevices() {
      return {
        items: [
          {
            id: "device-1",
            name: "MacBook Pro",
            type: "Computer",
            isActive: true,
            isRestricted: false,
            supportsVolume: true,
            volumePercent: 60
          }
        ]
      };
    },
    async getQueue() {
      return {
        items: [
          {
            trackName: "Go Your Own Way",
            artistName: "Fleetwood Mac",
            albumName: "Rumours",
            type: "track" as const
          }
        ]
      };
    },
    async getRecentlyPlayed() {
      return {
        items: [
          {
            id: "track-1",
            trackName: "Dreams",
            artistName: "Fleetwood Mac",
            albumName: "Rumours",
            uri: "spotify:track:1",
            durationMs: 257000,
            playedAt: "2026-04-08T10:00:00.000Z"
          }
        ]
      };
    },
    async getFeaturedPlaylists() {
      return {
        items: [
          {
            id: "playlist-1",
            name: "Focus Flow",
            description: "Deep work picks",
            imageUrl: "",
            ownerName: "Spotify",
            trackCount: 20,
            uri: "spotify:playlist:1"
          }
        ]
      };
    },
    async getPlaylists() {
      return {
        items: [
          {
            id: "playlist-2",
            name: "Daily Mix",
            description: "",
            imageUrl: "",
            ownerName: "Allar",
            trackCount: 12,
            uri: "spotify:playlist:2"
          }
        ]
      };
    },
    async getSavedTracks() {
      return {
        items: [
          {
            id: "track-2",
            trackName: "Duvet",
            artistName: "boa",
            albumName: "Twilight",
            uri: "spotify:track:2",
            durationMs: 201000
          }
        ]
      };
    },
    async getPlaylist() {
      return {
        id: "playlist-2",
        name: "Daily Mix",
        description: "",
        imageUrl: "",
        ownerName: "Allar",
        trackCount: 12,
        uri: "spotify:playlist:2",
        tracks: []
      };
    },
    async search() {
      return {
        tracks: [],
        playlists: [],
        albums: [],
        artists: []
      };
    },
    async play() {
      return { ok: true, action: "play" as const };
    },
    async pause() {
      return { ok: true, action: "pause" as const };
    },
    async next() {
      return { ok: true, action: "next" as const };
    },
    async previous() {
      return { ok: true, action: "previous" as const };
    },
    async playTrack() {
      return { ok: true, action: "play-track" as const };
    },
    async playContext() {
      return { ok: true, action: "play-context" as const };
    },
    async transferPlayback() {
      return { ok: true, action: "transfer" as const };
    },
    async setShuffle() {
      return { ok: true, action: "shuffle" as const };
    },
    async setRepeatMode() {
      return { ok: true, action: "repeat" as const };
    },
    async setVolume() {
      return { ok: true, action: "volume" as const };
    },
    async getProfile() {
      return {
        id: "spotify-user-1",
        displayName: "Allar",
        email: "allar@spotify.test",
        profileUrl: "https://open.spotify.com/user/allar",
        imageUrl: "https://i.scdn.co/image/avatar-1"
      };
    }
  };
}

describe("app routes", () => {
  test("returns health payload", async () => {
    const env = baseEnv();

    const app = createApp({
      env,
      logger: createLogger(env),
      auth: createAuthMock(null) as never,
      spotify: createSpotifyMock() as never,
      checkReadiness: async () => true
    });

    const response = await app.handle(new Request("http://localhost/health"));
    expect(response.status).toBe(200);

    const body = (await response.json()) as { name: string; status: string };
    expect(body.name).toBe("clipify-api");
    expect(body.status).toBe("ok");
    expect(response.headers.get("x-request-id")).toBeString();
  });

  test("returns ready when dependency check succeeds", async () => {
    const env = baseEnv();

    const app = createApp({
      env,
      logger: createLogger(env),
      auth: createAuthMock(null) as never,
      spotify: createSpotifyMock() as never,
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
      spotify: createSpotifyMock() as never,
      checkReadiness: async () => false
    });

    const response = await app.handle(new Request("http://localhost/ready"));
    expect(response.status).toBe(503);
  });

  test("returns public api version metadata", async () => {
    const env = baseEnv();

    const app = createApp({
      env,
      logger: createLogger(env),
      auth: createAuthMock(null) as never,
      spotify: createSpotifyMock() as never,
      checkReadiness: async () => true
    });

    const response = await app.handle(new Request("http://localhost/v1/public/meta/version"));
    expect(response.status).toBe(200);

    const body = (await response.json()) as { apiVersion: string; minCliVersion: string };
    expect(body.apiVersion).toBe("v1");
    expect(body.minCliVersion).toBe("0.1.0");
  });

  test("returns 404 for removed public example route", async () => {
    const env = baseEnv();

    const app = createApp({
      env,
      logger: createLogger(env),
      auth: createAuthMock(null) as never,
      spotify: createSpotifyMock() as never,
      checkReadiness: async () => true
    });

    const response = await app.handle(new Request("http://localhost/v1/public/example"));
    expect(response.status).toBe(404);
  });

  test("blocks protected me route without session", async () => {
    const env = baseEnv();

    const app = createApp({
      env,
      logger: createLogger(env),
      auth: createAuthMock(null) as never,
      spotify: createSpotifyMock() as never,
      checkReadiness: async () => true
    });

    const response = await app.handle(new Request("http://localhost/v1/me"));
    expect(response.status).toBe(401);

    const body = (await response.json()) as {
      error: { code: string; message: string };
    };
    expect(body.error.code).toBe("UNAUTHORIZED");
    expect(body.error.message).toContain("log in again");
  });

  test("returns protected me route with session", async () => {
    const env = baseEnv();

    const app = createApp({
      env,
      logger: createLogger(env),
      auth: createAuthMock({
        id: "u_123",
        email: "a@example.com",
        name: "Allar"
      }) as never,
      spotify: createSpotifyMock() as never,
      checkReadiness: async () => true
    });

    const response = await app.handle(new Request("http://localhost/v1/me"));
    expect(response.status).toBe(200);

    const body = (await response.json()) as { user: { id: string } };
    expect(body.user.id).toBe("u_123");
  });

  test("keeps openapi json route in production", async () => {
    const env = baseEnv("production");

    const app = createApp({
      env,
      logger: createLogger(env),
      auth: createAuthMock(null) as never,
      spotify: createSpotifyMock() as never,
      checkReadiness: async () => true
    });

    const response = await app.handle(new Request("http://localhost/openapi/json"));
    expect(response.status).toBe(200);
  });

  test("documents cookie security for protected routes in openapi spec", async () => {
    const env = baseEnv();

    const app = createApp({
      env,
      logger: createLogger(env),
      auth: createAuthMock(null) as never,
      spotify: createSpotifyMock() as never,
      checkReadiness: async () => true
    });

    const response = await app.handle(new Request("http://localhost/openapi/json"));
    expect(response.status).toBe(200);

    const spec = (await response.json()) as {
      tags?: Array<{ name: string; description?: string }>;
      components?: {
        securitySchemes?: {
          apiKeyCookie?: {
            type: string;
            in: string;
            name: string;
          };
        };
      };
      paths?: {
        [key: string]: {
          get?: {
            responses?: {
              [status: string]: {
                headers?: {
                  [name: string]: unknown;
                };
                content?: {
                  [contentType: string]: {
                    schema?: {
                      properties?: Record<string, unknown>;
                      headers?: {
                        properties?: Record<string, unknown>;
                      };
                    };
                  };
                };
              };
            };
            security?: Array<Record<string, unknown>>;
          };
          post?: {
            responses?: {
              [status: string]: {
                headers?: {
                  [name: string]: unknown;
                };
                content?: {
                  [contentType: string]: {
                    schema?: {
                      properties?: Record<string, unknown>;
                      headers?: {
                        properties?: Record<string, unknown>;
                      };
                    };
                  };
                };
              };
            };
            tags?: string[];
          };
        };
      };
    };

    expect(spec.tags?.map((tag) => tag.name)).toEqual(expect.arrayContaining(["system", "public", "auth", "user", "cli"]));
    expect(spec.components?.securitySchemes?.apiKeyCookie).toMatchObject({
      type: "apiKey",
      in: "cookie",
      name: "better-auth.session_token"
    });
    expect(
      spec.paths?.["/api/auth/sign-in/email"]?.post?.responses?.["200"]?.content?.["application/json"]?.schema?.headers?.properties?.["set-cookie"]
    ).toBeTruthy();
    expect(
      spec.paths?.["/api/auth/sign-up/email"]?.post?.responses?.["200"]?.content?.["application/json"]?.schema?.headers?.properties?.["set-cookie"]
    ).toBeTruthy();
    expect(
      spec.paths?.["/api/auth/sign-out"]?.post?.responses?.["200"]?.content?.["application/json"]?.schema?.headers?.properties?.["set-cookie"]
    ).toBeTruthy();
    expect(spec.paths?.["/v1/me"]?.get?.security).toContainEqual({
      apiKeyCookie: []
    });
    expect(spec.paths?.["/v1/cli/bootstrap"]?.get?.security).toContainEqual({
      apiKeyCookie: []
    });
    expect(
      spec.paths?.["/v1/me"]?.get?.responses?.["200"]?.content?.["application/json"]?.schema?.headers?.properties?.["x-request-id"]
    ).toBeTruthy();
    expect(
      spec.paths?.["/v1/me"]?.get?.responses?.["401"]?.content?.["application/json"]?.schema?.properties?.["error"]
    ).toBeTruthy();
    expect(
      spec.paths?.["/v1/cli/bootstrap"]?.get?.responses?.["200"]?.content?.["application/json"]?.schema?.headers?.properties?.["x-request-id"]
    ).toBeTruthy();
    expect(
      spec.paths?.["/health"]?.get?.responses?.["200"]?.content?.["application/json"]?.schema?.headers?.properties?.["x-request-id"]
    ).toBeTruthy();
    expect(
      spec.paths?.["/v1/public/meta/version"]?.get?.responses?.["200"]?.content?.["application/json"]?.schema?.headers?.properties?.["x-request-id"]
    ).toBeTruthy();
    expect(spec.paths?.["/api/auth/sign-in/email"]?.post?.tags).toContain("auth");
  });

  test("blocks openapi ui in production", async () => {
    const env = baseEnv("production");

    const app = createApp({
      env,
      logger: createLogger(env),
      auth: createAuthMock(null) as never,
      spotify: createSpotifyMock() as never,
      checkReadiness: async () => true
    });

    const response = await app.handle(new Request("http://localhost/openapi"));
    expect(response.status).toBe(404);
  });

  test("routes explicit auth sign-in requests through the typed auth endpoint wrapper", async () => {
    const env = baseEnv();
    const observed: { method?: string; url?: string; contentType?: string; body?: string } = {};

    const app = createApp({
      env,
      logger: createLogger(env),
      auth: createAuthMock(null, async (request) => {
        observed.method = request.method;
        observed.url = request.url;
        observed.contentType = request.headers.get("content-type") ?? undefined;
        observed.body = await request.text();

        return {
          headers: new Headers({
            "set-cookie": "better-auth.session_token=signed-token-123; Path=/; HttpOnly"
          }),
          response: {
            redirect: false,
            token: "token-1",
            user: {
              id: "u_123",
              email: "a@example.com",
              name: "Allar",
              emailVerified: true,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            }
          },
          status: 200
        };
      }) as never,
      spotify: createSpotifyMock() as never,
      checkReadiness: async () => true
    });

    const response = await app.handle(
      new Request("http://localhost/api/auth/sign-in/email", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          email: "a@example.com",
          password: "secret"
        })
      })
    );

    expect(response.status).toBe(200);
    expect(observed.method).toBe("POST");
    expect(observed.url).toBe("http://localhost/api/auth/sign-in/email");
    expect(observed.contentType).toBe("application/json");
    expect(observed.body).toBe(JSON.stringify({ email: "a@example.com", password: "secret" }));
    expect(response.headers.get("x-request-id")).toBeString();
  });

  test("maps cli validation failures to typed bad-request envelopes", async () => {
    const env = baseEnv();

    const app = createApp({
      env,
      logger: createLogger(env),
      auth: createAuthMock({
        id: "u_123",
        email: "a@example.com",
        name: "Allar"
      }) as never,
      spotify: createSpotifyMock() as never,
      checkReadiness: async () => true
    });

    const response = await app.handle(new Request("http://localhost/v1/cli/search"));
    expect(response.status).toBe(400);

    const body = (await response.json()) as {
      error: {
        code: string;
        message: string;
      };
    };

    expect(body.error.code).toBe("INVALID_INPUT");
    expect(body.error.message).toBe("Invalid request.");
  });

  test("blocks cli auth start route without session", async () => {
    const env = baseEnv();

    const app = createApp({
      env,
      logger: createLogger(env),
      auth: createAuthMock(null) as never,
      spotify: createSpotifyMock() as never,
      checkReadiness: async () => true
    });

    const response = await app.handle(new Request("http://localhost/v1/cli/auth/start"));
    expect(response.status).toBe(401);
  });

  test("returns cli auth status with session", async () => {
    const env = baseEnv();

    const app = createApp({
      env,
      logger: createLogger(env),
      auth: createAuthMock({
        id: "u_123",
        email: "a@example.com",
        name: "Allar"
      }) as never,
      spotify: createSpotifyMock() as never,
      checkReadiness: async () => true
    });

    const response = await app.handle(new Request("http://localhost/v1/cli/auth/status"));
    expect(response.status).toBe(200);

    const body = (await response.json()) as { linked: boolean; relinkRequired: boolean };
    expect(body.linked).toBeTrue();
    expect(body.relinkRequired).toBeFalse();
  });

  test("returns 404 for removed authenticated cli auth callback route", async () => {
    const env = baseEnv();

    const app = createApp({
      env,
      logger: createLogger(env),
      auth: createAuthMock({
        id: "u_123",
        email: "a@example.com",
        name: "Allar"
      }) as never,
      spotify: createSpotifyMock() as never,
      checkReadiness: async () => true
    });

    const response = await app.handle(new Request("http://localhost/v1/cli/auth/callback?code=c&state=s"));
    expect(response.status).toBe(404);
  });

  test("allows cli public callback route without session", async () => {
    const env = baseEnv();

    const app = createApp({
      env,
      logger: createLogger(env),
      auth: createAuthMock(null) as never,
      spotify: createSpotifyMock() as never,
      checkReadiness: async () => true
    });

    const response = await app.handle(
      new Request("http://localhost/v1/cli/auth/callback/public?code=code-1&state=state-1")
    );
    expect(response.status).toBe(200);
  });

  test("escapes untrusted oauth callback values in html response", async () => {
    const env = baseEnv();

    const app = createApp({
      env,
      logger: createLogger(env),
      auth: createAuthMock(null) as never,
      spotify: createSpotifyMock() as never,
      checkReadiness: async () => true
    });

    const response = await app.handle(
      new Request(
        "http://localhost/v1/cli/auth/callback/public?error=access_denied&error_description=%3Cscript%3Ealert%281%29%3C%2Fscript%3E"
      )
    );
    expect(response.status).toBe(400);

    const html = await response.text();
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(html).not.toContain("<script>alert(1)</script>");
  });

  test("returns cli bootstrap payload when session is present", async () => {
    const env = baseEnv();

    const app = createApp({
      env,
      logger: createLogger(env),
      auth: createAuthMock({
        id: "u_123",
        email: "a@example.com",
        name: "Allar"
      }) as never,
      spotify: createSpotifyMock() as never,
      checkReadiness: async () => true
    });

    const response = await app.handle(new Request("http://localhost/v1/cli/bootstrap"));
    expect(response.status).toBe(200);

    const body = (await response.json()) as {
      home: { spotify: string; userName: string; queueStatus: string };
      browse: { playlists: unknown[]; likedTracks: unknown[] };
    };
    expect(body.home.spotify).toBe("linked");
    expect(body.home.userName).toBe("Allar");
    expect(body.home.queueStatus).toBe("ready");
    expect(body.browse.playlists.length).toBeGreaterThan(0);
    expect(body.browse.likedTracks.length).toBeGreaterThan(0);
  });

  test("returns cli player snapshot payload when session is present", async () => {
    const env = baseEnv();

    const app = createApp({
      env,
      logger: createLogger(env),
      auth: createAuthMock({
        id: "u_123",
        email: "a@example.com",
        name: "Allar"
      }) as never,
      spotify: createSpotifyMock() as never,
      checkReadiness: async () => true
    });

    const response = await app.handle(new Request("http://localhost/v1/cli/player/snapshot"));
    expect(response.status).toBe(200);

    const body = (await response.json()) as {
      home: { spotify: string; userName: string; queueStatus: string };
      warning: string;
    };
    expect(body.home.spotify).toBe("linked");
    expect(body.home.userName).toBe("Allar");
    expect(body.home.queueStatus).toBe("ready");
  });

  test("reuses cached spotify profile across snapshot polls", async () => {
    const env = baseEnv();
    let profileCalls = 0;
    const spotify = {
      ...createSpotifyMock(),
      async getProfile() {
        profileCalls += 1;
        return {
          id: "spotify-user-1",
          displayName: "Allar",
          email: "allar@spotify.test",
          profileUrl: "https://open.spotify.com/user/allar",
          imageUrl: "https://i.scdn.co/image/avatar-1"
        };
      }
    };

    const app = createApp({
      env,
      logger: createLogger(env),
      auth: createAuthMock({
        id: "u_123",
        email: "a@example.com",
        name: "Allar"
      }) as never,
      spotify: spotify as never,
      checkReadiness: async () => true
    });

    const first = await app.handle(new Request("http://localhost/v1/cli/player/snapshot"));
    const second = await app.handle(new Request("http://localhost/v1/cli/player/snapshot"));
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(profileCalls).toBe(1);
  });

  test("reuses cached browse payload across bootstrap refreshes", async () => {
    const env = baseEnv();
    let featuredCalls = 0;
    let playlistsCalls = 0;
    let likedCalls = 0;
    const spotify = {
      ...createSpotifyMock(),
      async getFeaturedPlaylists() {
        featuredCalls += 1;
        return createSpotifyMock().getFeaturedPlaylists();
      },
      async getPlaylists() {
        playlistsCalls += 1;
        return createSpotifyMock().getPlaylists();
      },
      async getSavedTracks() {
        likedCalls += 1;
        return createSpotifyMock().getSavedTracks();
      }
    };

    const app = createApp({
      env,
      logger: createLogger(env),
      auth: createAuthMock({
        id: "u_123",
        email: "a@example.com",
        name: "Allar"
      }) as never,
      spotify: spotify as never,
      checkReadiness: async () => true
    });

    const first = await app.handle(new Request("http://localhost/v1/cli/bootstrap"));
    const second = await app.handle(new Request("http://localhost/v1/cli/bootstrap"));
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(featuredCalls).toBe(1);
    expect(playlistsCalls).toBe(1);
    expect(likedCalls).toBe(1);
  });

  test("returns snapshot with warning when player state call fails", async () => {
    const env = baseEnv();
    const spotify = {
      ...createSpotifyMock(),
      async getCurrentlyPlaying() {
        throw new Response("rate limited", { status: 429 });
      }
    };

    const app = createApp({
      env,
      logger: createLogger(env),
      auth: createAuthMock({
        id: "u_123",
        email: "a@example.com",
        name: "Allar"
      }) as never,
      spotify: spotify as never,
      checkReadiness: async () => true
    });

    const response = await app.handle(new Request("http://localhost/v1/cli/player/snapshot"));
    expect(response.status).toBe(200);

    const body = (await response.json()) as {
      home: { spotify: string; deviceName: string };
      warning: string;
    };

    expect(body.home.spotify).toBe("linked");
    expect(body.home.deviceName).toBe("MacBook Pro");
    expect(body.warning).toContain("player state unavailable");
  });

  test("returns 404 for removed cli home view route", async () => {
    const env = baseEnv();

    const app = createApp({
      env,
      logger: createLogger(env),
      auth: createAuthMock({
        id: "u_123",
        email: "a@example.com",
        name: "Allar"
      }) as never,
      spotify: createSpotifyMock() as never,
      checkReadiness: async () => true
    });

    const response = await app.handle(new Request("http://localhost/v1/cli/view/home"));
    expect(response.status).toBe(404);
  });

  test("runs cli player action endpoint", async () => {
    const env = baseEnv();

    const app = createApp({
      env,
      logger: createLogger(env),
      auth: createAuthMock({
        id: "u_123",
        email: "a@example.com",
        name: "Allar"
      }) as never,
      spotify: createSpotifyMock() as never,
      checkReadiness: async () => true
    });

    const response = await app.handle(
      new Request("http://localhost/v1/cli/player/action", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          action: "play-context",
          contextUri: "spotify:playlist:2"
        })
      })
    );
    expect(response.status).toBe(200);

    const body = (await response.json()) as { action: string };
    expect(body.action).toBe("play-context");
  });

});
