import { describe, expect, test } from "bun:test";
import { resolveAuthenticatedIntent } from "../src/authenticated-app-input";
import { createInitialAuthenticatedAppState } from "../src/authenticated-app-state";

describe("authenticated app input", () => {
  test("routes device picker keys before shell keys", () => {
    const state = {
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

    expect(resolveAuthenticatedIntent(state, "d", {})).toEqual({ type: "close-device-picker" });
    expect(resolveAuthenticatedIntent(state, "", { return: true })).toEqual({ type: "submit-device-selection" });
  });

  test("pressing enter on a selected playlist track activates it", () => {
    const state = {
      ...createInitialAuthenticatedAppState(""),
      mainView: "playlist-detail" as const,
      focusRegion: "content" as const,
      contentIndex: 1,
      homeSnapshot: {
        ...createInitialAuthenticatedAppState("").homeSnapshot,
        backend: "connected" as const,
        spotify: "linked" as const
      },
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

    expect(resolveAuthenticatedIntent(state, "", { return: true })).toEqual({ type: "activate-selected-item" });
  });

  test("escape closes playlist detail only when content is focused", () => {
    const state = {
      ...createInitialAuthenticatedAppState(""),
      mainView: "playlist-detail" as const,
      focusRegion: "content" as const,
      contentIndex: 1,
      homeSnapshot: {
        ...createInitialAuthenticatedAppState("").homeSnapshot,
        backend: "connected" as const,
        spotify: "linked" as const
      }
    };

    expect(resolveAuthenticatedIntent(state, "", { escape: true })).toEqual({ type: "close-playlist-detail" });
    expect(resolveAuthenticatedIntent({ ...state, focusRegion: "sidebar" as const }, "", { escape: true })).toEqual({ type: "none" });
  });

  test("sidebar arrows navigate library entries", () => {
    const state = {
      ...createInitialAuthenticatedAppState(""),
      focusRegion: "sidebar" as const,
      browseState: {
        ...createInitialAuthenticatedAppState("").browseState,
        playlists: [
          {
            id: "playlist-1",
            name: "Roadtrip",
            description: "",
            imageUrl: "",
            ownerName: "Allar",
            trackCount: 20,
            uri: "spotify:playlist:1"
          }
        ]
      }
    };

    expect(resolveAuthenticatedIntent(state, "", { downArrow: true })).toEqual({ type: "move-sidebar-selection", direction: "down" });
    expect(resolveAuthenticatedIntent(state, "", { rightArrow: true })).toEqual({ type: "set-focus-region", focusRegion: "content" });
    expect(resolveAuthenticatedIntent(state, "", { return: true })).toEqual({ type: "activate-sidebar-item" });
  });

  test("quick launch supports left/right column switching", () => {
    const state = {
      ...createInitialAuthenticatedAppState(""),
      mainView: "home" as const,
      focusRegion: "content" as const,
      contentIndex: 1,
      homeSnapshot: {
        ...createInitialAuthenticatedAppState("").homeSnapshot,
        backend: "connected" as const,
        spotify: "linked" as const
      },
      browseState: {
        ...createInitialAuthenticatedAppState("").browseState,
        playlists: [
          {
            id: "playlist-1",
            name: "Roadtrip",
            description: "",
            imageUrl: "",
            ownerName: "Allar",
            trackCount: 20,
            uri: "spotify:playlist:1"
          },
          {
            id: "playlist-2",
            name: "Focus",
            description: "",
            imageUrl: "",
            ownerName: "Allar",
            trackCount: 18,
            uri: "spotify:playlist:2"
          }
        ]
      }
    };

    expect(resolveAuthenticatedIntent(state, "", { rightArrow: true })).toEqual({ type: "set-content-index", contentIndex: 2 });
    expect(resolveAuthenticatedIntent({ ...state, contentIndex: 2 }, "", { leftArrow: true })).toEqual({
      type: "set-content-index",
      contentIndex: 1
    });
  });

  test("home grid up/down keeps the same column", () => {
    const state = {
      ...createInitialAuthenticatedAppState(""),
      mainView: "home" as const,
      focusRegion: "content" as const,
      contentIndex: 1,
      homeSnapshot: {
        ...createInitialAuthenticatedAppState("").homeSnapshot,
        backend: "connected" as const,
        spotify: "linked" as const
      },
      browseState: {
        ...createInitialAuthenticatedAppState("").browseState,
        playlists: [
          {
            id: "playlist-1",
            name: "A",
            description: "",
            imageUrl: "",
            ownerName: "Allar",
            trackCount: 20,
            uri: "spotify:playlist:1"
          },
          {
            id: "playlist-2",
            name: "B",
            description: "",
            imageUrl: "",
            ownerName: "Allar",
            trackCount: 18,
            uri: "spotify:playlist:2"
          },
          {
            id: "playlist-3",
            name: "C",
            description: "",
            imageUrl: "",
            ownerName: "Allar",
            trackCount: 16,
            uri: "spotify:playlist:3"
          },
          {
            id: "playlist-4",
            name: "D",
            description: "",
            imageUrl: "",
            ownerName: "Allar",
            trackCount: 12,
            uri: "spotify:playlist:4"
          }
        ],
        featuredPlaylists: [
          {
            id: "featured-1",
            name: "Pick 1",
            description: "",
            imageUrl: "",
            ownerName: "Spotify",
            trackCount: 10,
            uri: "spotify:playlist:f1"
          },
          {
            id: "featured-2",
            name: "Pick 2",
            description: "",
            imageUrl: "",
            ownerName: "Spotify",
            trackCount: 9,
            uri: "spotify:playlist:f2"
          }
        ]
      }
    };

    expect(resolveAuthenticatedIntent(state, "", { downArrow: true })).toEqual({ type: "set-content-index", contentIndex: 3 });
    expect(resolveAuthenticatedIntent({ ...state, contentIndex: 3 }, "", { downArrow: true })).toEqual({
      type: "set-content-index",
      contentIndex: 5
    });
    expect(resolveAuthenticatedIntent({ ...state, contentIndex: 5 }, "", { upArrow: true })).toEqual({
      type: "set-content-index",
      contentIndex: 3
    });
  });

  test("home grid up on first tile does not wrap to the last tile", () => {
    const state = {
      ...createInitialAuthenticatedAppState(""),
      mainView: "home" as const,
      focusRegion: "content" as const,
      contentIndex: 1,
      homeSnapshot: {
        ...createInitialAuthenticatedAppState("").homeSnapshot,
        backend: "connected" as const,
        spotify: "linked" as const
      },
      browseState: {
        ...createInitialAuthenticatedAppState("").browseState,
        playlists: [
          {
            id: "playlist-1",
            name: "A",
            description: "",
            imageUrl: "",
            ownerName: "Allar",
            trackCount: 20,
            uri: "spotify:playlist:1"
          },
          {
            id: "playlist-2",
            name: "B",
            description: "",
            imageUrl: "",
            ownerName: "Allar",
            trackCount: 18,
            uri: "spotify:playlist:2"
          }
        ],
        featuredPlaylists: [
          {
            id: "featured-1",
            name: "Pick 1",
            description: "",
            imageUrl: "",
            ownerName: "Spotify",
            trackCount: 10,
            uri: "spotify:playlist:f1"
          }
        ]
      }
    };

    expect(resolveAuthenticatedIntent(state, "", { upArrow: true })).toEqual({ type: "set-content-index", contentIndex: 0 });
  });

  test("playlist detail up moves from second track to first track", () => {
    const state = {
      ...createInitialAuthenticatedAppState(""),
      mainView: "playlist-detail" as const,
      focusRegion: "content" as const,
      contentIndex: 2,
      homeSnapshot: {
        ...createInitialAuthenticatedAppState("").homeSnapshot,
        backend: "connected" as const,
        spotify: "linked" as const
      },
      browseState: {
        ...createInitialAuthenticatedAppState("").browseState,
        playlistDetail: {
          id: "playlist-1",
          name: "Roadtrip",
          description: "",
          imageUrl: "",
          ownerName: "Allar",
          trackCount: 3,
          uri: "spotify:playlist:1",
          tracks: [
            {
              id: "track-1",
              trackName: "A",
              artistName: "Fleetwood Mac",
              albumName: "Rumours",
              uri: "spotify:track:1",
              durationMs: 257000
            },
            {
              id: "track-2",
              trackName: "B",
              artistName: "Fleetwood Mac",
              albumName: "Rumours",
              uri: "spotify:track:2",
              durationMs: 257000
            },
            {
              id: "track-3",
              trackName: "C",
              artistName: "Fleetwood Mac",
              albumName: "Rumours",
              uri: "spotify:track:3",
              durationMs: 257000
            }
          ]
        }
      }
    };

    expect(resolveAuthenticatedIntent(state, "", { upArrow: true })).toEqual({ type: "move-content-selection", direction: "up" });
    expect(resolveAuthenticatedIntent({ ...state, contentIndex: 1 }, "", { upArrow: true })).toEqual({
      type: "set-content-index",
      contentIndex: 0
    });
  });

  test("playlist detail down can reach the last track", () => {
    const state = {
      ...createInitialAuthenticatedAppState(""),
      mainView: "playlist-detail" as const,
      focusRegion: "content" as const,
      contentIndex: 3,
      homeSnapshot: {
        ...createInitialAuthenticatedAppState("").homeSnapshot,
        backend: "connected" as const,
        spotify: "linked" as const
      },
      browseState: {
        ...createInitialAuthenticatedAppState("").browseState,
        playlistDetail: {
          id: "playlist-1",
          name: "Roadtrip",
          description: "",
          imageUrl: "",
          ownerName: "Allar",
          trackCount: 4,
          uri: "spotify:playlist:1",
          tracks: [
            {
              id: "track-1",
              trackName: "A",
              artistName: "Fleetwood Mac",
              albumName: "Rumours",
              uri: "spotify:track:1",
              durationMs: 257000
            },
            {
              id: "track-2",
              trackName: "B",
              artistName: "Fleetwood Mac",
              albumName: "Rumours",
              uri: "spotify:track:2",
              durationMs: 257000
            },
            {
              id: "track-3",
              trackName: "C",
              artistName: "Fleetwood Mac",
              albumName: "Rumours",
              uri: "spotify:track:3",
              durationMs: 257000
            },
            {
              id: "track-4",
              trackName: "D",
              artistName: "Fleetwood Mac",
              albumName: "Rumours",
              uri: "spotify:track:4",
              durationMs: 257000
            }
          ]
        }
      }
    };

    expect(resolveAuthenticatedIntent(state, "", { downArrow: true })).toEqual({ type: "move-content-selection", direction: "down" });
    expect(resolveAuthenticatedIntent({ ...state, contentIndex: 4 }, "", { downArrow: true })).toEqual({ type: "none" });
  });

  test("shift arrows jump playlist detail selection by five tracks without crossing edges", () => {
    const state = {
      ...createInitialAuthenticatedAppState(""),
      mainView: "playlist-detail" as const,
      focusRegion: "content" as const,
      contentIndex: 4,
      homeSnapshot: {
        ...createInitialAuthenticatedAppState("").homeSnapshot,
        backend: "connected" as const,
        spotify: "linked" as const
      },
      browseState: {
        ...createInitialAuthenticatedAppState("").browseState,
        playlistDetail: {
          id: "playlist-1",
          name: "Roadtrip",
          description: "",
          imageUrl: "",
          ownerName: "Allar",
          trackCount: 12,
          uri: "spotify:playlist:1",
          tracks: Array.from({ length: 12 }, (_, index) => ({
            id: `track-${index + 1}`,
            trackName: `Track ${index + 1}`,
            artistName: "Fleetwood Mac",
            albumName: "Rumours",
            uri: `spotify:track:${index + 1}`,
            durationMs: 257000
          }))
        }
      }
    };

    expect(resolveAuthenticatedIntent(state, "", { downArrow: true, shift: true })).toEqual({
      type: "set-content-index",
      contentIndex: 9
    });
    expect(resolveAuthenticatedIntent({ ...state, contentIndex: 9 }, "", { upArrow: true, shift: true })).toEqual({
      type: "set-content-index",
      contentIndex: 4
    });
    expect(resolveAuthenticatedIntent({ ...state, contentIndex: 3 }, "", { upArrow: true, shift: true })).toEqual({
      type: "set-content-index",
      contentIndex: 1
    });
    expect(resolveAuthenticatedIntent({ ...state, contentIndex: 10 }, "", { downArrow: true, shift: true })).toEqual({
      type: "set-content-index",
      contentIndex: 12
    });
    expect(resolveAuthenticatedIntent({ ...state, contentIndex: 12 }, "", { downArrow: true, shift: true })).toEqual({ type: "none" });
  });

  test("control keys require command prefix", () => {
    const state = createInitialAuthenticatedAppState("");

    expect(resolveAuthenticatedIntent(state, "s", { super: true })).toEqual({ type: "activate-control-prefix" });
    expect(resolveAuthenticatedIntent(state, " ", {})).toEqual({ type: "none" });
    expect(resolveAuthenticatedIntent(state, ",", {})).toEqual({ type: "none" });
    expect(resolveAuthenticatedIntent(state, ".", {})).toEqual({ type: "none" });
    expect(resolveAuthenticatedIntent(state, "q", {})).toEqual({ type: "none" });
    expect(resolveAuthenticatedIntent(state, "d", {})).toEqual({ type: "none" });
    expect(resolveAuthenticatedIntent(state, "r", {})).toEqual({ type: "none" });
  });

  test("command prefix maps control keys to intents", () => {
    const state = {
      ...createInitialAuthenticatedAppState(""),
      controlPrefixActive: true
    };

    expect(resolveAuthenticatedIntent(state, " ", {})).toEqual({ type: "toggle-playback" });
    expect(resolveAuthenticatedIntent(state, ",", {})).toEqual({ type: "previous-track" });
    expect(resolveAuthenticatedIntent(state, ".", {})).toEqual({ type: "next-track" });
    expect(resolveAuthenticatedIntent(state, "s", {})).toEqual({ type: "toggle-shuffle", enabled: true });
    expect(resolveAuthenticatedIntent(state, "t", {})).toEqual({ type: "cycle-repeat", mode: "context" });
    expect(resolveAuthenticatedIntent(state, "d", {})).toEqual({ type: "open-device-picker" });
    expect(resolveAuthenticatedIntent(state, "r", {})).toEqual({ type: "refresh" });
    expect(resolveAuthenticatedIntent(state, "l", {})).toEqual({ type: "start-link" });
    expect(resolveAuthenticatedIntent(state, "o", {})).toEqual({ type: "logout" });
    expect(resolveAuthenticatedIntent(state, "q", {})).toEqual({ type: "exit" });
  });
});
