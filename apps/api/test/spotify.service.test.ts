import { describe, expect, test } from "bun:test";
import type { AppEnv } from "../src/config/env";
import { createStateHash } from "../src/modules/spotify/crypto";
import { createSpotifyService } from "../src/modules/spotify/service";

type StoreConnection = {
  id: string;
  userId: string;
  spotifyUserId: string;
  accessToken: string;
  refreshToken: string;
  scope: string | null;
  tokenType: string | null;
  expiresAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

type StoreOAuthState = {
  id: string;
  userId: string;
  stateHash: string;
  expiresAt: Date;
  createdAt: Date;
};

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
    PORT: 3000,
    SPOTIFY_CLIENT_ID: "spotify-client-id",
    SPOTIFY_CLIENT_SECRET: "spotify-client-secret",
    SPOTIFY_REDIRECT_URI: "http://127.0.0.1:3000/v1/spotify/auth/callback/public",
    SPOTIFY_TOKEN_ENCRYPTION_KEY: "MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY="
  };
}

function createMemoryStore(seedConnections: StoreConnection[] = [], seedStates: StoreOAuthState[] = []) {
  const connections = [...seedConnections];
  const oauthStates = [...seedStates];

  return {
    connections,
    oauthStates,
    async findByUserId(userId: string) {
      return connections.find((row) => row.userId === userId) ?? null;
    },
    async findBySpotifyUserId(spotifyUserId: string) {
      return connections.find((row) => row.spotifyUserId === spotifyUserId) ?? null;
    },
    async upsertConnection(connection: StoreConnection) {
      const index = connections.findIndex((row) => row.userId === connection.userId);
      if (index >= 0) {
        connections[index] = connection;
        return;
      }

      connections.push(connection);
    },
    async createOauthState(oauthState: StoreOAuthState) {
      oauthStates.push(oauthState);
    },
    async consumeOauthState(stateHash: string, now: Date) {
      const index = oauthStates.findIndex((row) => row.stateHash === stateHash && row.expiresAt.getTime() > now.getTime());

      if (index < 0) {
        return null;
      }

      const [consumed] = oauthStates.splice(index, 1);
      return consumed ?? null;
    }
  };
}

describe("spotify service", () => {
  test("builds authorization url and stores hashed state", async () => {
    const store = createMemoryStore();
    const service = createSpotifyService(baseEnv(), {
      store,
      randomUUID: () => "nonce-123",
      now: () => new Date("2026-02-18T00:00:00.000Z")
    });

    const result = await service.startAuthorization("user-1");
    const url = new URL(result.authorizeUrl);

    expect(url.origin).toBe("https://accounts.spotify.com");
    expect(url.searchParams.get("client_id")).toBe("spotify-client-id");
    expect(url.searchParams.get("scope")).toContain("user-read-private");
    expect(url.searchParams.get("scope")).toContain("user-read-playback-state");
    expect(url.searchParams.get("scope")).toContain("user-modify-playback-state");
    expect(url.searchParams.get("show_dialog")).toBe("true");
    expect(store.oauthStates).toHaveLength(1);
    expect(store.oauthStates[0]?.stateHash).toBe(createStateHash(result.state));
  });

  test("exchanges callback code and persists encrypted spotify connection", async () => {
    const store = createMemoryStore();
    const fetchCalls: string[] = [];
    const service = createSpotifyService(baseEnv(), {
      store,
      randomUUID: () => "conn-1",
      now: () => new Date("2026-02-18T00:00:00.000Z"),
      fetchImpl: async (url) => {
        fetchCalls.push(String(url));
        if (String(url).includes("/api/token")) {
          return Response.json({
            access_token: "access-1",
            refresh_token: "refresh-1",
            token_type: "Bearer",
            scope: "user-read-playback-state",
            expires_in: 3600
          });
        }

        return Response.json({ id: "spotify-user-1" });
      }
    });

    const { state } = await service.startAuthorization("user-1");
    const result = await service.completeAuthorization("user-1", "code-1", state);

    expect(result.linked).toBeTrue();
    expect(store.connections).toHaveLength(1);
    expect(store.connections[0]?.spotifyUserId).toBe("spotify-user-1");
    expect(store.connections[0]?.accessToken.startsWith("v1.")).toBeTrue();
    expect(store.connections[0]?.refreshToken.startsWith("v1.")).toBeTrue();
    expect(store.oauthStates).toHaveLength(0);
    expect(fetchCalls.some((url) => url.includes("/api/token"))).toBeTrue();
  });

  test("rejects callback when oauth state is invalid", async () => {
    const store = createMemoryStore();
    const service = createSpotifyService(baseEnv(), {
      store,
      fetchImpl: async () => Response.json({ id: "spotify-user-1" })
    });

    await expect(service.completeAuthorization("user-1", "code-1", "bad-state")).rejects.toBeInstanceOf(Response);
  });

  test("completes callback without authenticated session user", async () => {
    const store = createMemoryStore();
    const service = createSpotifyService(baseEnv(), {
      store,
      randomUUID: () => "conn-1",
      now: () => new Date("2026-02-18T00:00:00.000Z"),
      fetchImpl: async (url) => {
        if (String(url).includes("/api/token")) {
          return Response.json({
            access_token: "access-1",
            refresh_token: "refresh-1",
            token_type: "Bearer",
            scope: "user-read-playback-state",
            expires_in: 3600
          });
        }

        return Response.json({ id: "spotify-user-1" });
      }
    });

    const { state } = await service.startAuthorization("user-1");
    const result = await service.completeAuthorizationFromCallback("code-1", state);

    expect(result.linked).toBeTrue();
    expect(result.userId).toBe("user-1");
    expect(store.connections).toHaveLength(1);
  });

  test("refreshes expired token before currently playing request", async () => {
    const oldDate = new Date("2026-02-18T00:00:00.000Z");
    const bootstrapStore = createMemoryStore();
    const bootstrapService = createSpotifyService(baseEnv(), {
      store: bootstrapStore,
      fetchImpl: async (url) => {
        if (String(url).includes("/api/token")) {
          return Response.json({
            access_token: "expired-access",
            refresh_token: "refresh-1",
            token_type: "Bearer",
            expires_in: 1
          });
        }
        return Response.json({ id: "spotify-user-1" });
      }
    });

    const { state } = await bootstrapService.startAuthorization("user-1");
    await bootstrapService.completeAuthorization("user-1", "code-1", state);
    bootstrapStore.connections[0]!.expiresAt = oldDate;

    let currentlyPlayingCalls = 0;
    const service = createSpotifyService(baseEnv(), {
      store: bootstrapStore,
      now: () => new Date("2026-02-18T02:00:00.000Z"),
      fetchImpl: async (url) => {
        if (String(url).includes("/api/token")) {
          return Response.json({
            access_token: "fresh-access",
            refresh_token: "refresh-2",
            token_type: "Bearer",
            expires_in: 3600
          });
        }

        if (String(url).includes("/me/player/devices")) {
          return Response.json({
            devices: [
              {
                id: "device-1",
                is_active: true,
                is_restricted: false,
                name: "MacBook Pro",
                supports_volume: true,
                type: "Computer",
                volume_percent: 60
              }
            ]
          });
        }

        currentlyPlayingCalls += 1;
        return Response.json({
          is_playing: true,
          shuffle_state: true,
          repeat_state: "context",
          progress_ms: 120000,
          device: {
            id: "device-1",
            is_active: true,
            is_restricted: false,
            name: "MacBook Pro",
            supports_volume: true,
            type: "Computer",
            volume_percent: 60
          },
          item: {
            name: "Dreams",
            duration_ms: 257000,
            artists: [{ name: "Fleetwood Mac" }],
            album: {
              name: "Rumours",
              images: [{ url: "https://i.scdn.co/image/rumours" }]
            }
          }
        });
      }
    });

    const result = await service.getCurrentlyPlaying("user-1");

    expect(result.trackName).toBe("Dreams");
    expect(result.playbackState).toBe("playing");
    expect(result.deviceId).toBe("device-1");
    expect(result.deviceName).toBe("MacBook Pro");
    expect(result.shuffleEnabled).toBeTrue();
    expect(result.repeatMode).toBe("context");
    expect(result.volumePercent).toBe(60);
    expect(result.durationMs).toBe(257000);
    expect(currentlyPlayingCalls).toBe(1);
    expect(bootstrapStore.connections[0]?.accessToken.startsWith("v1.")).toBeTrue();
    expect(bootstrapStore.connections[0]?.refreshToken.startsWith("v1.")).toBeTrue();
  });

  test("returns recently played items for linked user", async () => {
    const bootstrapStore = createMemoryStore();
    const bootstrapService = createSpotifyService(baseEnv(), {
      store: bootstrapStore,
      fetchImpl: async (url) => {
        if (String(url).includes("/api/token")) {
          return Response.json({
            access_token: "access-1",
            refresh_token: "refresh-1",
            token_type: "Bearer",
            expires_in: 3600
          });
        }

        return Response.json({ id: "spotify-user-1" });
      }
    });

    const { state } = await bootstrapService.startAuthorization("user-1");
    await bootstrapService.completeAuthorization("user-1", "code-1", state);

    const service = createSpotifyService(baseEnv(), {
      store: bootstrapStore,
      fetchImpl: async (url) => {
        if (String(url).includes("/api/token")) {
          return Response.json({
            access_token: "access-1",
            refresh_token: "refresh-1",
            token_type: "Bearer",
            expires_in: 3600
          });
        }

        return Response.json({
          items: [
            {
              played_at: "2026-04-08T10:00:00.000Z",
              track: {
                name: "Dreams",
                artists: [{ name: "Fleetwood Mac" }],
                album: { name: "Rumours" }
              }
            }
          ]
        });
      }
    });

    const result = await service.getRecentlyPlayed("user-1");

    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.trackName).toBe("Dreams");
    expect(result.items[0]?.playedAt).toBe("2026-04-08T10:00:00.000Z");
  });

  test("returns queue items for linked user", async () => {
    const bootstrapStore = createMemoryStore();
    const bootstrapService = createSpotifyService(baseEnv(), {
      store: bootstrapStore,
      fetchImpl: async (url) => {
        if (String(url).includes("/api/token")) {
          return Response.json({
            access_token: "access-1",
            refresh_token: "refresh-1",
            token_type: "Bearer",
            expires_in: 3600
          });
        }

        return Response.json({ id: "spotify-user-1" });
      }
    });

    const { state } = await bootstrapService.startAuthorization("user-1");
    await bootstrapService.completeAuthorization("user-1", "code-1", state);

    const service = createSpotifyService(baseEnv(), {
      store: bootstrapStore,
      fetchImpl: async (url) => {
        if (String(url).includes("/api/token")) {
          return Response.json({
            access_token: "access-1",
            refresh_token: "refresh-1",
            token_type: "Bearer",
            expires_in: 3600
          });
        }

        return Response.json({
          queue: [
            {
              type: "track",
              name: "Go Your Own Way",
              artists: [{ name: "Fleetwood Mac" }],
              album: { name: "Rumours" }
            }
          ]
        });
      }
    });

    const result = await service.getQueue("user-1");

    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.trackName).toBe("Go Your Own Way");
  });

  test("runs player actions for linked user", async () => {
    const bootstrapStore = createMemoryStore();
    const bootstrapService = createSpotifyService(baseEnv(), {
      store: bootstrapStore,
      fetchImpl: async (url) => {
        if (String(url).includes("/api/token")) {
          return Response.json({
            access_token: "access-1",
            refresh_token: "refresh-1",
            token_type: "Bearer",
            expires_in: 3600
          });
        }

        return Response.json({ id: "spotify-user-1" });
      }
    });

    const { state } = await bootstrapService.startAuthorization("user-1");
    await bootstrapService.completeAuthorization("user-1", "code-1", state);

    const calls: string[] = [];
    const service = createSpotifyService(baseEnv(), {
      store: bootstrapStore,
      fetchImpl: async (url, init) => {
        if (String(url).includes("/api/token")) {
          return Response.json({
            access_token: "access-1",
            refresh_token: "refresh-1",
            token_type: "Bearer",
            expires_in: 3600
          });
        }

        calls.push(`${init?.method ?? "GET"} ${String(url)}`);
        return new Response(null, { status: 204 });
      }
    });

    await expect(service.play("user-1")).resolves.toEqual({ ok: true, action: "play" });
    await expect(service.pause("user-1")).resolves.toEqual({ ok: true, action: "pause" });
    await expect(service.next("user-1")).resolves.toEqual({ ok: true, action: "next" });
    await expect(service.previous("user-1")).resolves.toEqual({ ok: true, action: "previous" });

    expect(calls).toContain("PUT https://api.spotify.com/v1/me/player/play");
    expect(calls).toContain("PUT https://api.spotify.com/v1/me/player/pause");
    expect(calls).toContain("POST https://api.spotify.com/v1/me/player/next");
    expect(calls).toContain("POST https://api.spotify.com/v1/me/player/previous");
  });

  test("runs player mode actions for linked user", async () => {
    const bootstrapStore = createMemoryStore();
    const bootstrapService = createSpotifyService(baseEnv(), {
      store: bootstrapStore,
      fetchImpl: async (url) => {
        if (String(url).includes("/api/token")) {
          return Response.json({
            access_token: "access-1",
            refresh_token: "refresh-1",
            token_type: "Bearer",
            expires_in: 3600
          });
        }

        return Response.json({ id: "spotify-user-1" });
      }
    });

    const { state } = await bootstrapService.startAuthorization("user-1");
    await bootstrapService.completeAuthorization("user-1", "code-1", state);

    const calls: string[] = [];
    const service = createSpotifyService(baseEnv(), {
      store: bootstrapStore,
      fetchImpl: async (url, init) => {
        if (String(url).includes("/api/token")) {
          return Response.json({
            access_token: "access-1",
            refresh_token: "refresh-1",
            token_type: "Bearer",
            expires_in: 3600
          });
        }

        calls.push(`${init?.method ?? "GET"} ${String(url)}`);
        return new Response(null, { status: 204 });
      }
    });

    await expect(service.setShuffle("user-1", true)).resolves.toEqual({ ok: true, action: "shuffle" });
    await expect(service.setRepeatMode("user-1", "context")).resolves.toEqual({ ok: true, action: "repeat" });
    await expect(service.setVolume("user-1", 70)).resolves.toEqual({ ok: true, action: "volume" });

    expect(calls).toContain("PUT https://api.spotify.com/v1/me/player/shuffle?state=true");
    expect(calls).toContain("PUT https://api.spotify.com/v1/me/player/repeat?state=context");
    expect(calls).toContain("PUT https://api.spotify.com/v1/me/player/volume?volume_percent=70");
  });

  test("returns spotify profile for linked user", async () => {
    const bootstrapStore = createMemoryStore();
    const bootstrapService = createSpotifyService(baseEnv(), {
      store: bootstrapStore,
      fetchImpl: async (url) => {
        if (String(url).includes("/api/token")) {
          return Response.json({
            access_token: "access-1",
            refresh_token: "refresh-1",
            token_type: "Bearer",
            expires_in: 3600
          });
        }

        return Response.json({
          id: "spotify-user-1",
          display_name: "Allar",
          email: "allar@spotify.test",
          external_urls: { spotify: "https://open.spotify.com/user/allar" },
          images: [{ url: "https://i.scdn.co/image/avatar-1" }]
        });
      }
    });

    const { state } = await bootstrapService.startAuthorization("user-1");
    await bootstrapService.completeAuthorization("user-1", "code-1", state);

    const service = createSpotifyService(baseEnv(), {
      store: bootstrapStore,
      fetchImpl: async () =>
        Response.json({
          id: "spotify-user-1",
          display_name: "Allar",
          email: "allar@spotify.test",
          external_urls: { spotify: "https://open.spotify.com/user/allar" },
          images: [{ url: "https://i.scdn.co/image/avatar-1" }]
        })
    });

    const profile = await service.getProfile("user-1");

    expect(profile.id).toBe("spotify-user-1");
    expect(profile.displayName).toBe("Allar");
    expect(profile.email).toBe("allar@spotify.test");
    expect(profile.profileUrl).toBe("https://open.spotify.com/user/allar");
    expect(profile.imageUrl).toBe("https://i.scdn.co/image/avatar-1");
  });

  test("refreshes token and retries spotify profile after 401", async () => {
    const oldDate = new Date("2026-02-18T00:00:00.000Z");
    const bootstrapStore = createMemoryStore();
    const bootstrapService = createSpotifyService(baseEnv(), {
      store: bootstrapStore,
      fetchImpl: async (url) => {
        if (String(url).includes("/api/token")) {
          return Response.json({
            access_token: "expired-access",
            refresh_token: "refresh-1",
            token_type: "Bearer",
            expires_in: 1
          });
        }
        return Response.json({
          id: "spotify-user-1",
          display_name: "Allar"
        });
      }
    });

    const { state } = await bootstrapService.startAuthorization("user-1");
    await bootstrapService.completeAuthorization("user-1", "code-1", state);
    bootstrapStore.connections[0]!.expiresAt = oldDate;

    let profileCallCount = 0;
    const service = createSpotifyService(baseEnv(), {
      store: bootstrapStore,
      now: () => new Date("2026-02-18T02:00:00.000Z"),
      fetchImpl: async (url) => {
        if (String(url).includes("/api/token")) {
          return Response.json({
            access_token: "fresh-access",
            refresh_token: "refresh-2",
            token_type: "Bearer",
            expires_in: 3600
          });
        }

        profileCallCount += 1;
        if (profileCallCount === 1) {
          return new Response("unauthorized", { status: 401 });
        }

        return Response.json({
          id: "spotify-user-1",
          display_name: "Allar"
        });
      }
    });

    const profile = await service.getProfile("user-1");

    expect(profile.id).toBe("spotify-user-1");
    expect(profile.displayName).toBe("Allar");
    expect(profileCallCount).toBe(2);
  });
});
