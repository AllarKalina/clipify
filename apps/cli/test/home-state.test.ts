import { describe, expect, test } from "bun:test";
import type { ApiClient } from "@clipify/api-client";
import { ApiClientError } from "@clipify/api-client";
import { computeHomeSnapshot } from "../src/home-state";

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
    getSpotifyCurrentlyPlaying: async () => ({
      playbackState: "playing",
      isPlaying: true,
      trackName: "Dreams",
      artistName: "Fleetwood Mac",
      albumName: "Rumours",
      albumImageUrl: "https://i.scdn.co/image/rumours",
      deviceName: "MacBook Pro",
      deviceType: "Computer",
      progressMs: 120000,
      durationMs: 257000
    }),
    getSpotifyRecentlyPlayed: async () => ({
      items: [
        {
          trackName: "Dreams",
          artistName: "Fleetwood Mac",
          albumName: "Rumours",
          playedAt: "2026-04-08T10:00:00.000Z"
        }
      ]
    }),
    playSpotify: async () => ({ ok: true, action: "play" }),
    pauseSpotify: async () => ({ ok: true, action: "pause" }),
    nextSpotify: async () => ({ ok: true, action: "next" }),
    previousSpotify: async () => ({ ok: true, action: "previous" }),
    ...overrides
  };
}

describe("home state", () => {
  test("builds linked home snapshot", async () => {
    const snapshot = await computeHomeSnapshot(createClient({}));

    expect(snapshot.backend).toBe("connected");
    expect(snapshot.spotify).toBe("linked");
    expect(snapshot.trackName).toBe("Dreams");
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
});
