import { describe, expect, test } from "bun:test";
import { createSpotifyService } from "../src/modules/spotify/service";
import { baseEnv, createLinkedSpotifyService, createMemoryStore } from "./spotify.service.test-support";

describe("spotify service profile", () => {
  test("returns spotify profile for linked user", async () => {
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

        return Response.json({
          id: "spotify-user-1",
          display_name: "Allar",
          email: "allar@spotify.test",
          external_urls: { spotify: "https://open.spotify.com/user/allar" },
          images: [{ url: "https://i.scdn.co/image/avatar-1" }]
        });
      }
    });

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
