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

  test("set search query only updates the draft", () => {
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

    expect(next.mainView).toBe("search-results");
    expect(next.browseState.searchQuery).toBe("");
  });

  test("submitting search query switches to results and marks it busy", () => {
    const initial = {
      ...createInitialAuthenticatedAppState(""),
      browseState: {
        ...createInitialAuthenticatedAppState("").browseState,
        searchQuery: " weekend "
      }
    };

    const next = authenticatedAppReducer(initial, {
      type: "submit-search-query"
    });

    expect(next.mainView).toBe("search-results");
    expect(next.browseState.submittedSearchQuery).toBe("weekend");
    expect(next.browseState.searchRequestId).toBe(1);
    expect(next.browseState.searchBusy).toBeTrue();
  });

  test("reset search clears draft, submitted query, and pending state", () => {
    const initial = {
      ...createInitialAuthenticatedAppState(""),
      browseState: {
        ...createInitialAuthenticatedAppState("").browseState,
        searchQuery: "weekend",
        submittedSearchQuery: "weekend",
        searchRequestId: 2,
        searchBusy: true,
        searchError: "nope",
        searchResults: {
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
      }
    };

    const next = authenticatedAppReducer(initial, {
      type: "reset-search"
    });

    expect(next.browseState.searchQuery).toBe("");
    expect(next.browseState.submittedSearchQuery).toBe("");
    expect(next.browseState.searchRequestId).toBe(0);
    expect(next.browseState.searchBusy).toBeFalse();
    expect(next.browseState.searchResults.tracks).toHaveLength(0);
  });

  test("selection movement is bounded at list edges", () => {
    const withSidebar = {
      ...createInitialAuthenticatedAppState(""),
      sidebarIndex: 0,
      browseState: {
        ...createInitialAuthenticatedAppState("").browseState,
        playlists: [
          {
            id: "playlist-1",
            name: "One",
            description: "",
            imageUrl: "",
            ownerName: "Allar",
            trackCount: 12,
            uri: "spotify:playlist:1"
          }
        ]
      }
    };

    const sidebarUp = authenticatedAppReducer(withSidebar, {
      type: "move-sidebar-selection",
      direction: "up"
    });
    expect(sidebarUp.sidebarIndex).toBe(0);

    const withContent = {
      ...createInitialAuthenticatedAppState(""),
      mainView: "playlist-detail" as const,
      contentIndex: 1,
      browseState: {
        ...createInitialAuthenticatedAppState("").browseState,
        playlistDetail: {
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
      }
    };

    const contentDown = authenticatedAppReducer(withContent, {
      type: "move-content-selection",
      direction: "down"
    });
    expect(contentDown.contentIndex).toBe(1);

    const withDevice = {
      ...createInitialAuthenticatedAppState(""),
      devicePicker: {
        open: true,
        loading: false,
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
        ],
        selectedIndex: 0
      }
    };

    const deviceUp = authenticatedAppReducer(withDevice, {
      type: "move-device-selection",
      direction: "up"
    });
    expect(deviceUp.devicePicker.selectedIndex).toBe(0);
  });
});
