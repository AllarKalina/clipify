import { describe, expect, test } from "bun:test";
import type { ApiClient } from "@clipify/api-client";
import { executeContentAction } from "../src/authenticated-app-commands";
import {
  authenticatedAppReducer,
  createInitialAuthenticatedAppState,
  type AuthenticatedAppAction,
  type AuthenticatedAppState
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
    getCliBootstrap: async () => {
      throw new Error("should not bootstrap");
    },
    getCliPlayerSnapshot: async () => {
      throw new Error("should not refresh player");
    },
    getCliLibraryView: async () => ({ section: null }),
    searchCli: async () => ({ tracks: [], playlists: [], albums: [], artists: [] }),
    getCliDevices: async () => ({ items: [] }),
    runCliPlayerAction: async () => {
      throw new Error("should not play");
    },
    ...overrides
  };
}

describe("authenticated app quick launch", () => {
  test("opens the playlist without restarting playback when its context is already playing", async () => {
    let playerAction: unknown = null;
    const actions: AuthenticatedAppAction[] = [];
    let state: AuthenticatedAppState = {
      ...createInitialAuthenticatedAppState("Ready"),
      homeSnapshot: {
        ...createInitialAuthenticatedAppState("Ready").homeSnapshot,
        backend: "connected",
        spotify: "linked",
        playbackState: "playing",
        contextUri: "spotify:playlist:1"
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

    expect(playerAction).toBeNull();
    expect(actions).toContainEqual({
      type: "open-playlist-detail",
      detail: expect.objectContaining({
        id: "playlist-1",
        name: "Roadtrip"
      })
    });
  });
});
