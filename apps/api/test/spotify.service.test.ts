import { describe, expect, test } from "bun:test";
import type { AppEnv } from "../src/config/env";
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
    SPOTIFY_REDIRECT_URI: "http://localhost:3000/v1/spotify/auth/callback"
  };
}

function createMemoryStore(seed: StoreConnection[] = []) {
  const rows = [...seed];
  return {
    rows,
    async findByUserId(userId: string) {
      return rows.find((row) => row.userId === userId) ?? null;
    },
    async findBySpotifyUserId(spotifyUserId: string) {
      return rows.find((row) => row.spotifyUserId === spotifyUserId) ?? null;
    },
    async upsert(connection: StoreConnection) {
      const index = rows.findIndex((row) => row.userId === connection.userId);
      if (index >= 0) {
        rows[index] = connection;
        return;
      }

      rows.push(connection);
    }
  };
}

describe("spotify service", () => {
  test("builds authorization url", () => {
    const store = createMemoryStore();
    const service = createSpotifyService(baseEnv(), {
      store,
      randomUUID: () => "nonce-123",
      now: () => new Date("2026-02-18T00:00:00.000Z")
    });

    const result = service.startAuthorization("user-1");
    const url = new URL(result.authorizeUrl);

    expect(url.origin).toBe("https://accounts.spotify.com");
    expect(url.searchParams.get("client_id")).toBe("spotify-client-id");
    expect(url.searchParams.get("scope")).toContain("user-read-playback-state");
    expect(result.state.length > 10).toBeTrue();
  });

  test("exchanges callback code and persists spotify connection", async () => {
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

    const { state } = service.startAuthorization("user-1");
    const result = await service.completeAuthorization("user-1", "code-1", state);

    expect(result.linked).toBeTrue();
    expect(store.rows).toHaveLength(1);
    expect(store.rows[0]?.spotifyUserId).toBe("spotify-user-1");
    expect(fetchCalls.some((url) => url.includes("/api/token"))).toBeTrue();
  });

  test("refreshes expired token before currently playing request", async () => {
    const oldDate = new Date("2026-02-18T00:00:00.000Z");
    const store = createMemoryStore([
      {
        id: "conn-1",
        userId: "user-1",
        spotifyUserId: "spotify-user-1",
        accessToken: "expired-access",
        refreshToken: "refresh-1",
        tokenType: "Bearer",
        scope: "user-read-playback-state",
        expiresAt: oldDate,
        createdAt: oldDate,
        updatedAt: oldDate
      }
    ]);

    let currentlyPlayingCalls = 0;
    const service = createSpotifyService(baseEnv(), {
      store,
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
    expect(store.rows[0]?.accessToken).toBe("fresh-access");
    expect(store.rows[0]?.refreshToken).toBe("refresh-2");
  });

  test("fails currently-playing when account is not linked", async () => {
    const store = createMemoryStore();
    const service = createSpotifyService(baseEnv(), {
      store
    });

    try {
      await service.getCurrentlyPlaying("user-1");
      throw new Error("expected getCurrentlyPlaying to fail");
    } catch (error) {
      expect(error).toBeInstanceOf(Response);
      expect((error as Response).status).toBe(409);
    }
  });
});
