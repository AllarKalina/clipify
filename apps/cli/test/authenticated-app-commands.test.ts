import { describe, expect, test } from "bun:test";
import type { ApiClient } from "@clipify/api-client";
import { ApiClientError } from "@clipify/api-client";
import { executeContentAction, refreshAuthenticatedApp } from "../src/authenticated-app-commands";
import { getPlaybackFailureMessage } from "../src/authenticated-app-utils";
import {
  authenticatedAppReducer,
  createInitialAuthenticatedAppState,
  type AuthenticatedAppState,
  type AuthenticatedAppAction
} from "../src/authenticated-app-state";

function createClient(overrides: Partial<ApiClient>): ApiClient {
  return {
    getVersion: async () => ({ appName: "clipify-api", apiVersion: "v1", minCliVersion: "0.1.0", latestCliVersion: "0.1.0" }),
    getMe: async () => ({ user: { id: "user-1", email: "allar@example.com", name: "Allar" } }),
    signUpWithEmailPassword: async () => ({ sessionCookie: "better-auth.session_token=signup" }),
    signInWithEmailPassword: async () => ({ sessionCookie: "better-auth.session_token=signin" }),
    signOut: async () => undefined,
    startCliAuthorization: async () => ({ authorizeUrl: "https://accounts.spotify.com/authorize?state=abc", state: "abc" }),
    getCliAuthorizationStatus: async () => ({ linked: true, relinkRequired: false }),
    getCliBootstrap: async () => ({
      home: {
        spotify: "linked",
        userName: "Allar",
        userEmail: "allar@example.com",
        spotifyDisplayName: "Allar",
        deviceId: "device-1",
        deviceName: "MacBook Air",
        deviceType: "Computer",
        deviceStatus: "active",
        supportsVolume: true,
        volumePercent: 50,
        playbackState: "paused",
        shuffleEnabled: false,
        repeatMode: "off",
        trackName: "Dreams",
        artistName: "Fleetwood Mac",
        albumName: "Rumours",
        contextUri: "",
        progressMs: 120000,
        durationMs: 257000,
        queueStatus: "ready",
        queue: [],
        recentUnavailable: false,
        recent: [],
        linked: true,
        relinkRequired: false,
        profile: {
          id: "spotify-user-1",
          displayName: "Allar",
          email: "allar@spotify.test",
          profileUrl: "https://open.spotify.com/user/allar",
          imageUrl: "https://i.scdn.co/image/avatar-1"
        }
      },
      browse: {
        featuredPlaylists: [],
        playlists: [],
        likedTracks: []
      },
      warning: ""
    }),
    getCliPlayerSnapshot: async () => ({
      home: {
        spotify: "linked",
        userName: "Allar",
        userEmail: "allar@example.com",
        spotifyDisplayName: "Allar",
        deviceId: "device-1",
        deviceName: "MacBook Air",
        deviceType: "Computer",
        deviceStatus: "active",
        supportsVolume: true,
        volumePercent: 50,
        playbackState: "paused",
        shuffleEnabled: false,
        repeatMode: "off",
        trackName: "Dreams",
        artistName: "Fleetwood Mac",
        albumName: "Rumours",
        contextUri: "",
        progressMs: 120000,
        durationMs: 257000,
        queueStatus: "ready",
        queue: [],
        recentUnavailable: false,
        recent: [],
        linked: true,
        relinkRequired: false,
        profile: {
          id: "spotify-user-1",
          displayName: "Allar",
          email: "allar@spotify.test",
          profileUrl: "https://open.spotify.com/user/allar",
          imageUrl: "https://i.scdn.co/image/avatar-1"
        }
      },
      warning: ""
    }),
    getCliLibraryView: async () => ({ section: null }),
    searchCli: async () => ({ tracks: [], playlists: [], albums: [], artists: [] }),
    getCliDevices: async () => ({
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
    runCliPlayerAction: async () => ({ ok: true, action: "play" }),
    ...overrides
  };
}

describe("authenticated app commands", () => {
  test("refresh loads bootstrap and updates snapshot", async () => {
    const initialState = createInitialAuthenticatedAppState("Restoring session...");
    const actions: AuthenticatedAppAction[] = [];

    await refreshAuthenticatedApp(
      {
        client: createClient({}),
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

    const snapshotActions = actions.filter((action) => action.type === "replace-home-snapshot");
    expect(snapshotActions.at(0)).toEqual({
      type: "replace-home-snapshot",
      snapshot: expect.objectContaining({
        spotify: "linked",
        trackName: "Dreams",
        spotifyDisplayName: "Allar"
      })
    });
  });

  test("refresh applies bootstrap warning to status line", async () => {
    const initialState = createInitialAuthenticatedAppState("Restoring session...");
    const actions: AuthenticatedAppAction[] = [];

    await refreshAuthenticatedApp(
      {
        client: createClient({
          getCliBootstrap: async () => ({
            home: {
              spotify: "linked",
              userName: "Allar",
              userEmail: "allar@example.com",
              spotifyDisplayName: "Allar",
              deviceId: "device-1",
              deviceName: "MacBook Air",
              deviceType: "Computer",
              deviceStatus: "active",
              supportsVolume: true,
              volumePercent: 50,
              playbackState: "paused",
              shuffleEnabled: false,
              repeatMode: "off",
              trackName: "Dreams",
              artistName: "Fleetwood Mac",
              albumName: "Rumours",
              contextUri: "",
              progressMs: 120000,
              durationMs: 257000,
              queueStatus: "ready",
              queue: [],
              recentUnavailable: false,
              recent: [],
              linked: true,
              relinkRequired: false,
              profile: null
            },
            browse: {
              featuredPlaylists: [],
              playlists: [],
              likedTracks: []
            },
            warning: "Browse data incomplete: playlists unavailable"
          })
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
      statusLine: "Browse data incomplete: playlists unavailable"
    });
  });

  test("refresh collapses multi-source bootstrap warnings to a concise message", async () => {
    const initialState = createInitialAuthenticatedAppState("Restoring session...");
    const actions: AuthenticatedAppAction[] = [];

    await refreshAuthenticatedApp(
      {
        client: createClient({
          getCliBootstrap: async () => ({
            home: {
              spotify: "linked",
              userName: "Allar",
              userEmail: "allar@example.com",
              spotifyDisplayName: "Allar",
              deviceId: "device-1",
              deviceName: "MacBook Air",
              deviceType: "Computer",
              deviceStatus: "active",
              supportsVolume: true,
              volumePercent: 50,
              playbackState: "paused",
              shuffleEnabled: false,
              repeatMode: "off",
              trackName: "Dreams",
              artistName: "Fleetwood Mac",
              albumName: "Rumours",
              contextUri: "",
              progressMs: 120000,
              durationMs: 257000,
              queueStatus: "ready",
              queue: [],
              recentUnavailable: false,
              recent: [],
              linked: true,
              relinkRequired: false,
              profile: null
            },
            browse: {
              featuredPlaylists: [],
              playlists: [],
              likedTracks: []
            },
            warning: "profile unavailable | recent playback unavailable | liked songs unavailable"
          })
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
      statusLine: "Spotify returned partial data. Press [cmd+s] then [r] to refresh."
    });
  });

  test("refresh reconciles ready device details from device list", async () => {
    const initialState = createInitialAuthenticatedAppState("Restoring session...");
    const actions: AuthenticatedAppAction[] = [];

    await refreshAuthenticatedApp(
      {
        client: createClient({
          getCliBootstrap: async () => ({
            home: {
              spotify: "linked",
              userName: "Allar",
              userEmail: "allar@example.com",
              spotifyDisplayName: "Allar",
              deviceId: "",
              deviceName: "",
              deviceType: "",
              deviceStatus: "none",
              supportsVolume: false,
              volumePercent: 0,
              playbackState: "idle",
              shuffleEnabled: false,
              repeatMode: "off",
              trackName: "",
              artistName: "",
              albumName: "",
              contextUri: "",
              progressMs: 0,
              durationMs: 0,
              queueStatus: "ready",
              queue: [],
              recentUnavailable: false,
              recent: [],
              linked: true,
              relinkRequired: false,
              profile: null
            },
            browse: {
              featuredPlaylists: [],
              playlists: [],
              likedTracks: []
            },
            warning: ""
          }),
          getCliDevices: async () => ({
            items: [
              {
                id: "device-2",
                name: "Living Room",
                type: "Speaker",
                isActive: false,
                isRestricted: false,
                supportsVolume: true,
                volumePercent: 35
              }
            ]
          })
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

    const snapshots = actions.filter((action) => action.type === "replace-home-snapshot");
    expect(snapshots).toHaveLength(2);
    expect(snapshots.at(-1)).toEqual({
      type: "replace-home-snapshot",
      snapshot: expect.objectContaining({
        deviceName: "Living Room",
        deviceStatus: "available",
        volumePercent: 35
      })
    });
  });

  test("maps no-device playback failures to actionable copy", () => {
    expect(
      getPlaybackFailureMessage(
        new ApiClientError("No active Spotify device. Start playback in Spotify first.", 409, "/v1/cli/player/action"),
        "Started playback"
      )
    ).toBe("No active Spotify device. Press [cmd+s] then [d] to transfer playback, or start playback in Spotify first.");
  });

  test("maps no-device playback failures with available device context", () => {
    expect(
      getPlaybackFailureMessage(
        new ApiClientError("No active Spotify device. Start playback in Spotify first.", 409, "/v1/cli/player/action", "NO_ACTIVE_DEVICE"),
        "Started playback",
        {
          deviceName: "Living Room",
          deviceStatus: "available"
        }
      )
    ).toBe("Living Room is available, but playback is controlled elsewhere. Press [cmd+s] then [d] to transfer.");
  });

  test("quick launch opens playlist detail and starts playlist playback", async () => {
    let playerAction: unknown = null;
    const actions: AuthenticatedAppAction[] = [];
    let state: AuthenticatedAppState = {
      ...createInitialAuthenticatedAppState("Ready"),
      homeSnapshot: {
        ...createInitialAuthenticatedAppState("Ready").homeSnapshot,
        backend: "connected" as const,
        spotify: "linked" as const
      },
      browseState: {
        ...createInitialAuthenticatedAppState("Ready").browseState,
        playlists: [
          {
            id: "playlist-1",
            name: "Roadtrip",
            description: "",
            imageUrl: "",
            ownerName: "Allar",
            trackCount: 24,
            uri: "spotify:playlist:1"
          }
        ]
      }
    };

    executeContentAction(
      {
        client: createClient({
          getCliLibraryView: async () =>
            ({
              section: {
                id: "playlist-1",
                title: "Roadtrip",
                items: [
                  {
                    id: "track-1",
                    title: "Dreams",
                    subtitle: "Fleetwood Mac",
                    meta: "Rumours",
                    action: { uri: "spotify:track:1" }
                  }
                ]
              }
            }) as Awaited<ReturnType<ApiClient["getCliLibraryView"]>>,
          runCliPlayerAction: async (action) => {
            playerAction = action;
            return { ok: true, action: "play" };
          }
        }),
        dispatch(action) {
          actions.push(action);
          state = authenticatedAppReducer(state, action);
        },
        getState: () => state,
        onLogoutComplete() {
          throw new Error("should not logout");
        },
        openBrowserOnLink: false
      },
      { type: "play-and-open-playlist", playlistId: "playlist-1", uri: "spotify:playlist:1" }
    );

    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(playerAction).toEqual({ action: "play-context", contextUri: "spotify:playlist:1" });
    expect(actions).toContainEqual({
      type: "open-playlist-detail",
      detail: expect.objectContaining({
        id: "playlist-1",
        name: "Roadtrip",
        tracks: [expect.objectContaining({ trackName: "Dreams" })]
      })
    });
  });

  test("refresh logs out on unauthorized bootstrap", async () => {
    const initialState = createInitialAuthenticatedAppState("Restoring session...");
    let didLogout = false;

    await refreshAuthenticatedApp(
      {
        client: createClient({
          getCliBootstrap: async () => {
            throw new ApiClientError("unauthorized", 401, "/v1/cli/bootstrap");
          }
        }),
        dispatch() {},
        getState: () => initialState,
        onLogoutComplete() {
          didLogout = true;
        },
        openBrowserOnLink: false
      },
      "Refreshed"
    );

    expect(didLogout).toBeTrue();
  });
});
