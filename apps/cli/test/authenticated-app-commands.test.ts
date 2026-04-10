import { describe, expect, test } from "bun:test";
import type { ApiClient } from "@clipify/api-client";
import { ApiClientError } from "@clipify/api-client";
import { refreshAuthenticatedApp } from "../src/authenticated-app-commands";
import { createInitialAuthenticatedAppState, type AuthenticatedAppAction } from "../src/authenticated-app-state";

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
      playbackState: "idle",
      isPlaying: false,
      trackName: "",
      artistName: "",
      albumName: "",
      albumImageUrl: "",
      deviceId: "device-1",
      deviceName: "MacBook Air",
      deviceType: "Computer",
      deviceStatus: "available",
      supportsVolume: true,
      volumePercent: 50,
      shuffleEnabled: false,
      repeatMode: "off",
      progressMs: 0,
      durationMs: 0
    }),
    getSpotifyDevices: async () => ({
      items: [
        {
          id: "device-1",
          name: "MacBook Air",
          type: "Computer",
          isActive: true,
          isRestricted: false,
          supportsVolume: true,
          volumePercent: 50
        }
      ]
    }),
    getSpotifyQueue: async () => ({ items: [] }),
    getSpotifyRecentlyPlayed: async () => ({ items: [] }),
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

describe("authenticated app commands", () => {
  test("refresh surfaces browse-load failures in the status line", async () => {
    const initialState = createInitialAuthenticatedAppState("Restoring session...");
    const actions: AuthenticatedAppAction[] = [];

    await refreshAuthenticatedApp(
      {
        client: createClient({
          getSpotifyPlaylists: async () => {
            throw new ApiClientError("forbidden", 403, "/v1/spotify/me/playlists");
          }
        }),
        dispatch(action) {
          actions.push(action);
        },
        getState: () => initialState,
        onLogoutComplete() {
          throw new Error("should not logout");
        },
        openBrowserOnLink: false
      },
      "Refreshed"
    );

    const statusActions = actions.filter((action) => action.type === "set-status-line");
    expect(statusActions.at(-1)).toEqual({
      type: "set-status-line",
      statusLine: "Browse data incomplete: playlists: forbidden"
    });
  });
});
