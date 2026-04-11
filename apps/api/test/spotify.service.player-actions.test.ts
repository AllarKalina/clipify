import { describe, expect, test } from "bun:test";
import { createSpotifyService } from "../src/modules/spotify/service";
import { baseEnv, createLinkedSpotifyService, createMemoryStore } from "./spotify.service.test-support";

describe("spotify service player actions", () => {
  test("runs player actions for linked user", async () => {
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

  test("transfers playback to a selected device without autoplay", async () => {
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

    let transferBody = "";
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

        transferBody = String(init?.body ?? "");
        return new Response(null, { status: 204 });
      }
    });

    await expect(service.transferPlayback("user-1", "device-2")).resolves.toEqual({ ok: true, action: "transfer" });
    expect(transferBody).toBe(JSON.stringify({ device_ids: ["device-2"], play: false }));
  });
});
