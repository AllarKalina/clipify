import { describe, expect, test } from "bun:test";
import type { ApiClient } from "@clipify/api-client";
import { ApiClientError } from "@clipify/api-client";
import {
  applyProgressTick,
  computeHomeSnapshot,
  reconcilePlayerDevice,
  refreshPlayerSnapshot,
  shouldBackgroundRefresh,
  shouldTickPlayback
} from "../src/home-state";

function createClient(overrides: Partial<ApiClient>): ApiClient {
  return {
    getVersion: async () => ({ appName: "clipify-api", apiVersion: "v1", minCliVersion: "0.1.0", latestCliVersion: "0.1.0" }),
    getPublicExample: async () => ({ id: "1", title: "example", category: "demo" }),
    getMe: async () => ({ user: { id: "user-1", email: "allar@example.com", name: "Allar" } }),
    signUpWithEmailPassword: async () => ({ sessionCookie: "better-auth.session_token=signup" }),
    signInWithEmailPassword: async () => ({ sessionCookie: "better-auth.session_token=signin" }),
    signOut: async () => undefined,
    startSpotifyAuthorization: async () => ({ authorizeUrl: "https://accounts.spotify.com/authorize?state=abc", state: "abc" }),
    completeSpotifyAuthorization: async () => ({ linked: true, userId: "user-1" }),
    getSpotifyAuthorizationStatus: async () => ({ linked: true }),
    getSpotifyProfile: async () => ({
      id: "spotify-user-1",
      displayName: "Allar",
      email: "allar@spotify.test",
      profileUrl: "https://open.spotify.com/user/allar",
      imageUrl: "https://i.scdn.co/image/avatar-1"
    }),
    getSpotifyFeaturedPlaylists: async () => ({ items: [] }),
    getSpotifyPlaylists: async () => ({ items: [] }),
    getSpotifySavedTracks: async () => ({ items: [] }),
    getSpotifyPlaylist: async () => ({
      id: "playlist-1",
      name: "Roadtrip",
      description: "",
      imageUrl: "",
      ownerName: "Allar",
      trackCount: 1,
      uri: "spotify:playlist:1",
      tracks: []
    }),
    searchSpotify: async () => ({ tracks: [], playlists: [], albums: [], artists: [] }),
    getSpotifyCurrentlyPlaying: async () => ({
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
    }),
    getSpotifyDevices: async () => ({
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
    }),
    getSpotifyQueue: async () => ({
      items: [
        {
          trackName: "Go Your Own Way",
          artistName: "Fleetwood Mac",
          albumName: "Rumours",
          type: "track"
        }
      ]
    }),
    getSpotifyRecentlyPlayed: async () => ({
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
    }),
    playSpotify: async () => ({ ok: true, action: "play" }),
    pauseSpotify: async () => ({ ok: true, action: "pause" }),
    nextSpotify: async () => ({ ok: true, action: "next" }),
    previousSpotify: async () => ({ ok: true, action: "previous" }),
    playSpotifyTrack: async () => ({ ok: true, action: "play-track" }),
    playSpotifyContext: async () => ({ ok: true, action: "play-context" }),
    transferSpotifyPlayback: async () => ({ ok: true, action: "transfer" }),
    setSpotifyShuffle: async () => ({ ok: true, action: "shuffle" }),
    setSpotifyRepeatMode: async () => ({ ok: true, action: "repeat" }),
    setSpotifyVolume: async () => ({ ok: true, action: "volume" }),
    ...overrides
  };
}

describe("home state", () => {
  test("builds linked home snapshot", async () => {
    const snapshot = await computeHomeSnapshot(createClient({}));

    expect(snapshot.backend).toBe("connected");
    expect(snapshot.spotify).toBe("linked");
    expect(snapshot.trackName).toBe("Dreams");
    expect(snapshot.queue[0]?.trackName).toBe("Go Your Own Way");
    expect(snapshot.recent[0]?.trackName).toBe("Dreams");
  });

  test("returns not-linked state without calling playback endpoints", async () => {
    const snapshot = await computeHomeSnapshot(
      createClient({
        getSpotifyAuthorizationStatus: async () => ({ linked: false }),
        getSpotifyProfile: async () => {
          throw new Error("should not be called");
        }
      })
    );

    expect(snapshot.spotify).toBe("not-linked");
    expect(snapshot.trackName).toBe("");
    expect(snapshot.recent).toHaveLength(0);
  });

  test("swallows recent-history scope failure", async () => {
    const snapshot = await computeHomeSnapshot(
      createClient({
        getSpotifyRecentlyPlayed: async () => {
          throw new ApiClientError("forbidden", 403, "/v1/spotify/me/player/recently-played");
        }
      })
    );

    expect(snapshot.spotify).toBe("linked");
    expect(snapshot.recent).toHaveLength(0);
    expect(snapshot.recentUnavailable).toBeTrue();
  });

  test("maps queue no-device failure to queue status", async () => {
    const snapshot = await computeHomeSnapshot(
      createClient({
        getSpotifyQueue: async () => {
          throw new ApiClientError("no device", 409, "/v1/spotify/me/player/queue");
        }
      })
    );

    expect(snapshot.queue).toHaveLength(0);
    expect(snapshot.queueStatus).toBe("no-device");
  });

  test("ticks progress while playing and clamps at duration", async () => {
    const snapshot = await computeHomeSnapshot(createClient({}));
    const ticked = applyProgressTick(snapshot, 5_000);
    const clamped = applyProgressTick(snapshot, 300_000);

    expect(ticked.progressMs).toBe(125000);
    expect(clamped.progressMs).toBe(snapshot.durationMs);
  });

  test("does not tick progress while paused or idle", async () => {
    const playing = await computeHomeSnapshot(createClient({}));
    const paused = { ...playing, playbackState: "paused" as const };
    const idle = { ...playing, playbackState: "idle" as const };

    expect(applyProgressTick(paused, 5000).progressMs).toBe(paused.progressMs);
    expect(applyProgressTick(idle, 5000).progressMs).toBe(idle.progressMs);
    expect(shouldTickPlayback(paused)).toBeFalse();
    expect(shouldTickPlayback(idle)).toBeFalse();
  });

  test("only background refreshes while linked and playing", async () => {
    const playing = await computeHomeSnapshot(createClient({}));
    const paused = { ...playing, playbackState: "paused" as const };
    const unlinked = { ...playing, spotify: "not-linked" as const };

    expect(shouldBackgroundRefresh(playing)).toBeTrue();
    expect(shouldBackgroundRefresh(paused)).toBeFalse();
    expect(shouldBackgroundRefresh(unlinked)).toBeFalse();
  });

  test("player refresh avoids full home fetches", async () => {
    const current = await computeHomeSnapshot(createClient({}));
    let getMeCalls = 0;
    let getProfileCalls = 0;
    let getRecentCalls = 0;
    let getQueueCalls = 0;

    const next = await refreshPlayerSnapshot(
      createClient({
        getMe: async () => {
          getMeCalls += 1;
          return { user: { id: "user-1", email: "allar@example.com", name: "Allar" } };
        },
        getSpotifyProfile: async () => {
          getProfileCalls += 1;
          return {
            id: "spotify-user-1",
            displayName: "Allar",
            email: "allar@spotify.test",
            profileUrl: "https://open.spotify.com/user/allar",
            imageUrl: "https://i.scdn.co/image/avatar-1"
          };
        },
        getSpotifyRecentlyPlayed: async () => {
          getRecentCalls += 1;
          return { items: [] };
        },
        getSpotifyQueue: async () => {
          getQueueCalls += 1;
          return { items: [] };
        },
        getSpotifyCurrentlyPlaying: async () => ({
          playbackState: "paused",
          isPlaying: false,
          trackName: "Duro",
          artistName: "Skrillex",
          albumName: "Duro",
          albumImageUrl: "https://i.scdn.co/image/duro",
          deviceId: "device-1",
          deviceName: "MacBook Pro",
          deviceType: "Computer",
          deviceStatus: "active",
          supportsVolume: true,
          volumePercent: 70,
          shuffleEnabled: true,
          repeatMode: "context",
          progressMs: 10_000,
          durationMs: 185_000
        })
      }),
      current
    );

    expect(next.trackName).toBe("Duro");
    expect(next.volumePercent).toBe(70);
    expect(next.shuffleEnabled).toBeTrue();
    expect(next.repeatMode).toBe("context");
    expect(getMeCalls).toBe(0);
    expect(getProfileCalls).toBe(0);
    expect(getRecentCalls).toBe(0);
    expect(getQueueCalls).toBe(0);
  });

  test("reconciles ready devices when no active playback device is reported", async () => {
    const snapshot = await computeHomeSnapshot(
      createClient({
        getSpotifyCurrentlyPlaying: async () => ({
          playbackState: "idle",
          isPlaying: false,
          trackName: "",
          artistName: "",
          albumName: "",
          albumImageUrl: "",
          deviceId: "",
          deviceName: "",
          deviceType: "",
          deviceStatus: "none",
          supportsVolume: false,
          volumePercent: 0,
          shuffleEnabled: false,
          repeatMode: "off",
          progressMs: 0,
          durationMs: 0
        })
      })
    );

    const next = reconcilePlayerDevice(snapshot, [
      {
        id: "device-2",
        name: "Living Room",
        type: "Speaker",
        isActive: false,
        isRestricted: false,
        supportsVolume: true,
        volumePercent: 35
      }
    ]);

    expect(next.deviceName).toBe("Living Room");
    expect(next.deviceStatus).toBe("available");
    expect(next.supportsVolume).toBeTrue();
    expect(next.volumePercent).toBe(35);
  });

  test("reconciles active device from device list when playback endpoint is stale", async () => {
    const snapshot = await computeHomeSnapshot(
      createClient({
        getSpotifyCurrentlyPlaying: async () => ({
          playbackState: "paused",
          isPlaying: false,
          trackName: "Dreams",
          artistName: "Fleetwood Mac",
          albumName: "Rumours",
          albumImageUrl: "https://i.scdn.co/image/rumours",
          deviceId: "device-old",
          deviceName: "Old Speaker",
          deviceType: "Speaker",
          deviceStatus: "available",
          supportsVolume: false,
          volumePercent: 0,
          shuffleEnabled: false,
          repeatMode: "off",
          progressMs: 0,
          durationMs: 257000
        })
      })
    );

    const next = reconcilePlayerDevice(snapshot, [
      {
        id: "device-3",
        name: "MacBook Pro",
        type: "Computer",
        isActive: true,
        isRestricted: false,
        supportsVolume: true,
        volumePercent: 60
      }
    ]);

    expect(next.deviceId).toBe("device-3");
    expect(next.deviceName).toBe("MacBook Pro");
    expect(next.deviceStatus).toBe("active");
  });
});
