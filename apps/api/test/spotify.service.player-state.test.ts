import { describe, expect, test } from "bun:test";
import { createSpotifyService } from "../src/modules/spotify/service";
import { baseEnv, createLinkedSpotifyService, createMemoryStore, grantedScope } from "./spotify.service.test-support";

describe("spotify service player state", () => {
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
          context: {
            uri: "spotify:playlist:1"
          },
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
    expect(result.contextUri).toBe("spotify:playlist:1");
    expect(result.volumePercent).toBe(60);
    expect(result.durationMs).toBe(257000);
    expect(currentlyPlayingCalls).toBe(1);
    expect(bootstrapStore.connections[0]?.accessToken.startsWith("v1.")).toBeTrue();
    expect(bootstrapStore.connections[0]?.refreshToken.startsWith("v1.")).toBeTrue();
  });

  test("returns normalized spotify devices for linked user", async () => {
    const bootstrapStore = createMemoryStore();
    await createLinkedSpotifyService({
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

    const service = createSpotifyService(baseEnv(), {
      store: bootstrapStore,
      fetchImpl: async () =>
        Response.json({
          devices: [
            {
              id: "device-1",
              name: "MacBook Pro",
              type: "Computer",
              is_active: true,
              is_restricted: false,
              supports_volume: true,
              volume_percent: 60
            },
            {
              id: "device-2",
              name: "Office Speaker",
              type: "Speaker",
              is_active: false,
              is_restricted: true,
              supports_volume: false,
              volume_percent: 0
            }
          ]
        })
    });

    const result = await service.getDevices("user-1");

    expect(result.items).toHaveLength(2);
    expect(result.items[0]).toEqual({
      id: "device-1",
      name: "MacBook Pro",
      type: "Computer",
      isActive: true,
      isRestricted: false,
      supportsVolume: true,
      volumePercent: 60
    });
    expect(result.items[1]?.isRestricted).toBeTrue();
  });

  test("returns recently played items for linked user", async () => {
    const bootstrapStore = createMemoryStore();
    await createLinkedSpotifyService({
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
    await createLinkedSpotifyService({
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
});
