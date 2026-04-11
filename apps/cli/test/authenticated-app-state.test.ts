import { describe, expect, test } from "bun:test";
import { authenticatedAppReducer, createInitialAuthenticatedAppState } from "../src/authenticated-app-state";

describe("authenticated app state", () => {
  test("changing main view resets content selection and exits search editing", () => {
    const initial = {
      ...createInitialAuthenticatedAppState("Restoring session..."),
      mainView: "search-results" as const,
      contentIndex: 4,
      searchEditing: true
    };

    const next = authenticatedAppReducer(initial, {
      type: "set-main-view",
      mainView: "home"
    });

    expect(next.mainView).toBe("home");
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

  test("search completion stores results and switches to search-results", () => {
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

    expect(next.mainView).toBe("search-results");
    expect(next.browseState.searchBusy).toBeFalse();
    expect(next.browseState.searchResults.tracks[0]?.trackName).toBe("Dreams");
  });

  test("opening playlist detail switches the main pane and selects the first track", () => {
    const initial = {
      ...createInitialAuthenticatedAppState(""),
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
        tracks: [
          {
            id: "track-1",
            trackName: "Dreams",
            artistName: "Fleetwood Mac",
            albumName: "Rumours",
            uri: "spotify:track:1",
            durationMs: 257000
          }
        ]
      }
    });

    expect(next.mainView).toBe("playlist-detail");
    expect(next.contentIndex).toBe(1);
    expect(next.browseState.playlistDetail?.name).toBe("Roadtrip");
  });

  test("opening an empty playlist detail leaves the search row selected", () => {
    const next = authenticatedAppReducer(createInitialAuthenticatedAppState(""), {
      type: "open-playlist-detail",
      detail: {
        id: "playlist-1",
        name: "Roadtrip",
        description: "",
        imageUrl: "",
        ownerName: "Allar",
        trackCount: 0,
        uri: "spotify:playlist:1",
        tracks: []
      }
    });

    expect(next.contentIndex).toBe(0);
  });

  test("set search query transitions empty search-results back home", () => {
    const initial = {
      ...createInitialAuthenticatedAppState(""),
      mainView: "search-results" as const,
      browseState: {
        ...createInitialAuthenticatedAppState("").browseState,
        searchQuery: "weekend"
      }
    };

    const next = authenticatedAppReducer(initial, {
      type: "set-search-query",
      searchQuery: ""
    });

    expect(next.mainView).toBe("home");
  });
});
