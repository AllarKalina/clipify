import { describe, expect, test } from "bun:test";
import { authenticatedAppReducer, createInitialAuthenticatedAppState } from "../src/authenticated-app-state";

describe("authenticated app state", () => {
  test("changing page resets content selection and exits search editing", () => {
    const initial = {
      ...createInitialAuthenticatedAppState("Restoring session..."),
      appPage: "search" as const,
      contentIndex: 4,
      searchEditing: true
    };

    const next = authenticatedAppReducer(initial, {
      type: "set-page",
      page: "library"
    });

    expect(next.appPage).toBe("library");
    expect(next.contentIndex).toBe(0);
    expect(next.searchEditing).toBeFalse();
  });

  test("device list clamps selected index", () => {
    const initial = {
      ...createInitialAuthenticatedAppState(""),
      devicePicker: {
        open: true,
        loading: true,
        devices: [],
        selectedIndex: 8
      }
    };

    const next = authenticatedAppReducer(initial, {
      type: "set-device-list",
      devices: [
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
    });

    expect(next.devicePicker.selectedIndex).toBe(0);
    expect(next.devicePicker.devices).toHaveLength(1);
  });

  test("search completion stores results and clears busy state", () => {
    const initial = authenticatedAppReducer(createInitialAuthenticatedAppState(""), {
      type: "search-started"
    });

    const next = authenticatedAppReducer(initial, {
      type: "search-completed",
      results: {
        tracks: [
          {
            id: "track-1",
            trackName: "Dreams",
            artistName: "Fleetwood Mac",
            albumName: "Rumours",
            uri: "spotify:track:1",
            durationMs: 257000
          }
        ],
        playlists: [],
        albums: [],
        artists: []
      }
    });

    expect(next.browseState.searchBusy).toBeFalse();
    expect(next.browseState.searchError).toBe("");
    expect(next.browseState.searchResults.tracks[0]?.trackName).toBe("Dreams");
  });

  test("home snapshot replacement syncs recent tracks into browse state", () => {
    const next = authenticatedAppReducer(createInitialAuthenticatedAppState(""), {
      type: "replace-home-snapshot",
      snapshot: {
        ...createInitialAuthenticatedAppState("").homeSnapshot,
        backend: "connected",
        spotify: "linked",
        recent: [
          {
            id: "track-1",
            trackName: "Dreams",
            artistName: "Fleetwood Mac",
            albumName: "Rumours",
            uri: "spotify:track:1",
            durationMs: 257000,
            playedAt: "2026-04-11T09:00:00.000Z"
          }
        ]
      }
    });

    expect(next.browseState.recentTracks[0]?.trackName).toBe("Dreams");
  });

  test("opening playlist detail forces playlists page and resets selection", () => {
    const initial = {
      ...createInitialAuthenticatedAppState(""),
      appPage: "home" as const,
      contentIndex: 3
    };

    const next = authenticatedAppReducer(initial, {
      type: "open-playlist-detail",
      detail: {
        id: "playlist-1",
        name: "Roadtrip",
        description: "",
        imageUrl: "",
        ownerName: "Allar",
        trackCount: 1,
        uri: "spotify:playlist:1",
        tracks: []
      }
    });

    expect(next.appPage).toBe("playlists");
    expect(next.contentIndex).toBe(0);
    expect(next.browseState.playlistDetail?.name).toBe("Roadtrip");
  });
});
