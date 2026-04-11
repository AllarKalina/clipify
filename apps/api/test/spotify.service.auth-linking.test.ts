import { describe, expect, test } from "bun:test";
import { createStateHash } from "../src/modules/spotify/crypto";
import { createSpotifyService } from "../src/modules/spotify/service";
import { baseEnv, createMemoryStore } from "./spotify.service.test-support";

describe("spotify service auth linking", () => {
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
    expect(url.searchParams.get("scope")).toContain("playlist-read-private");
    expect(url.searchParams.get("scope")).toContain("playlist-read-collaborative");
    expect(url.searchParams.get("scope")).toContain("user-library-read");
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

  test("reports relink required when stored scopes are stale", async () => {
    const oldDate = new Date("2026-02-18T00:00:00.000Z");
    const store = createMemoryStore([
      {
        id: "conn-1",
        userId: "user-1",
        spotifyUserId: "spotify-user-1",
        accessToken: "encrypted-access",
        refreshToken: "encrypted-refresh",
        scope: "user-read-private user-read-email user-read-playback-state user-read-recently-played user-modify-playback-state",
        tokenType: "Bearer",
        expiresAt: oldDate,
        createdAt: oldDate,
        updatedAt: oldDate
      }
    ]);
    const service = createSpotifyService(baseEnv(), { store });

    await expect(service.getAuthorizationStatus("user-1")).resolves.toEqual({
      linked: true,
      relinkRequired: true
    });
  });

  test("reports current scope grants without relink requirement", async () => {
    const oldDate = new Date("2026-02-18T00:00:00.000Z");
    const store = createMemoryStore([
      {
        id: "conn-1",
        userId: "user-1",
        spotifyUserId: "spotify-user-1",
        accessToken: "encrypted-access",
        refreshToken: "encrypted-refresh",
        scope:
          "user-read-private user-read-email user-read-playback-state user-read-recently-played user-modify-playback-state playlist-read-private playlist-read-collaborative user-library-read",
        tokenType: "Bearer",
        expiresAt: oldDate,
        createdAt: oldDate,
        updatedAt: oldDate
      }
    ]);
    const service = createSpotifyService(baseEnv(), { store });

    await expect(service.getAuthorizationStatus("user-1")).resolves.toEqual({
      linked: true,
      relinkRequired: false
    });
  });
});
