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
    SPOTIFY_REDIRECT_URI: "http://localhost:3000/v1/spotify/auth/callback",
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
    async consumeOauthState(userId: string, stateHash: string, now: Date) {
      const index = oauthStates.findIndex(
        (row) => row.userId === userId && row.stateHash === stateHash && row.expiresAt.getTime() > now.getTime()
      );

      if (index < 0) {
        return false;
      }

      oauthStates.splice(index, 1);
      return true;
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
    expect(url.searchParams.get("scope")).toContain("user-read-playback-state");
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

        currentlyPlayingCalls += 1;
        return Response.json({
          is_playing: true,
          item: {
            name: "Dreams",
            artists: [{ name: "Fleetwood Mac" }],
            album: { name: "Rumours" }
          }
        });
      }
    });

    const result = await service.getCurrentlyPlaying("user-1");

    expect(result.trackName).toBe("Dreams");
    expect(currentlyPlayingCalls).toBe(1);
    expect(bootstrapStore.connections[0]?.accessToken.startsWith("v1.")).toBeTrue();
    expect(bootstrapStore.connections[0]?.refreshToken.startsWith("v1.")).toBeTrue();
  });
});
