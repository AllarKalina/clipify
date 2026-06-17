import { describe, expect, test } from "bun:test";
import { selectCanStartSearchEditing, selectShellViewModel } from "../src/authenticated-app-selectors";
import { createInitialAuthenticatedAppState } from "../src/authenticated-app-state";
import { buildVisibleListLines, formatPlaylistDetailHeader } from "../src/app-page-body";
import { getSearchInputLine, getSearchPromptLine, getTopBarHeight } from "../src/app-top-bar";

describe("authenticated app selectors", () => {
  test("builds home sections as quick launch plus picked for you", () => {
    const state = {
      ...createInitialAuthenticatedAppState(""),
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
            trackCount: 24,
            uri: "spotify:playlist:1"
          }
        ],
        featuredPlaylists: [
          {
            id: "featured-1",
            name: "Mint",
            description: "Fresh electronic picks",
            imageUrl: "",
            ownerName: "Spotify",
            trackCount: 50,
            uri: "spotify:playlist:featured-1"
          }
        ]
      }
    };

    const viewModel = selectShellViewModel(state);
    expect(viewModel.activeSections.map((section) => section.title)).toEqual([" Quick launch", " Picked for you"]);
    expect(viewModel.activeSections[0]?.items[0]?.action).toEqual({
      type: "play-context",
      uri: "spotify:playlist:1"
    });
    expect(viewModel.selectedItem?.title).toBe("Roadtrip");
  });

  test("builds sidebar library items with liked songs first", () => {
    const state = {
      ...createInitialAuthenticatedAppState(""),
      browseState: {
        ...createInitialAuthenticatedAppState("").browseState,
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
        ],
        likedTracks: [
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
    };

    const viewModel = selectShellViewModel(state);
    expect(viewModel.sidebarItems[0]?.title).toBe(" Liked songs");
    expect(viewModel.sidebarItems[1]?.title).toBe("Roadtrip");
  });

  test("orders sidebar playlists with pinned first, then liked songs, then owned-by-user", () => {
    const state = {
      ...createInitialAuthenticatedAppState(""),
      homeSnapshot: {
        ...createInitialAuthenticatedAppState("").homeSnapshot,
        backend: "connected" as const,
        spotify: "linked" as const,
        userName: "Allar",
        spotifyDisplayName: "Allar Kalina"
      },
      browseState: {
        ...createInitialAuthenticatedAppState("").browseState,
        playlists: [
          {
            id: "playlist-z",
            name: "Zoo",
            description: "",
            imageUrl: "",
            ownerName: "Another User",
            isPinned: false,
            trackCount: 5,
            uri: "spotify:playlist:z"
          },
          {
            id: "playlist-a",
            name: "Alpha",
            description: "",
            imageUrl: "",
            ownerName: "Allar Kalina",
            isPinned: false,
            trackCount: 10,
            uri: "spotify:playlist:a"
          },
          {
            id: "playlist-p",
            name: "Pinned Mix",
            description: "",
            imageUrl: "",
            ownerName: "Another User",
            isPinned: true,
            trackCount: 20,
            uri: "spotify:playlist:p"
          }
        ]
      }
    };

    const viewModel = selectShellViewModel(state);
    expect(viewModel.sidebarItems.map((item) => item.title)).toEqual([" Pinned Mix", " Liked songs", "Alpha", "Zoo"]);
  });

  test("preserves spotify playlist order when priority rank is equal", () => {
    const state = {
      ...createInitialAuthenticatedAppState(""),
      homeSnapshot: {
        ...createInitialAuthenticatedAppState("").homeSnapshot,
        backend: "connected" as const,
        spotify: "linked" as const,
        userName: "Allar",
        spotifyDisplayName: "Allar Kalina"
      },
      browseState: {
        ...createInitialAuthenticatedAppState("").browseState,
        playlists: [
          {
            id: "playlist-hah",
            name: "Hah",
            description: "",
            imageUrl: "",
            ownerName: "Allar Kalina",
            isPinned: false,
            trackCount: 10,
            uri: "spotify:playlist:hah"
          },
          {
            id: "playlist-mud",
            name: "Mud",
            description: "",
            imageUrl: "",
            ownerName: "Allar Kalina",
            isPinned: false,
            trackCount: 10,
            uri: "spotify:playlist:mud"
          },
          {
            id: "playlist-hrr",
            name: "Hrr",
            description: "",
            imageUrl: "",
            ownerName: "Allar Kalina",
            isPinned: false,
            trackCount: 10,
            uri: "spotify:playlist:hrr"
          }
        ]
      }
    };

    const viewModel = selectShellViewModel(state);
    expect(viewModel.sidebarItems.map((item) => item.title)).toEqual([" Liked songs", "Hah", "Mud", "Hrr"]);
  });

  test("search bar is the only search-edit entry point", () => {
    const emptyMain = {
      ...createInitialAuthenticatedAppState(""),
      homeSnapshot: {
        ...createInitialAuthenticatedAppState("").homeSnapshot,
        backend: "connected" as const,
        spotify: "linked" as const
      }
    };
    const populatedMain = {
      ...emptyMain,
      contentIndex: 1,
      browseState: {
        ...emptyMain.browseState,
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
      },
      homeSnapshot: {
        ...emptyMain.homeSnapshot,
        backend: "connected" as const,
        spotify: "linked" as const
      }
    };

    expect(selectCanStartSearchEditing(emptyMain)).toBeTrue();
    expect(selectCanStartSearchEditing(populatedMain)).toBeFalse();
  });

  test("shows relink-required library placeholder and blocks search editing", () => {
    const state = {
      ...createInitialAuthenticatedAppState(""),
      homeSnapshot: {
        ...createInitialAuthenticatedAppState("").homeSnapshot,
        backend: "connected" as const,
        spotify: "relink-required" as const
      }
    };

    const viewModel = selectShellViewModel(state);
    expect(viewModel.sidebarItems[0]?.title).toBe("Spotify re-link required");
    expect(selectCanStartSearchEditing(state)).toBeFalse();
  });

  test("builds playlist detail rows from loaded playlist tracks", () => {
    const state = {
      ...createInitialAuthenticatedAppState(""),
      mainView: "playlist-detail" as const,
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

    const viewModel = selectShellViewModel(state);
    expect(viewModel.activeSections.map((section) => section.title)).toEqual(["Roadtrip"]);
    expect(viewModel.activeSections[0]?.items[0]?.title).toBe("Dreams");
  });

  test("list viewport keeps consecutive playlist rows around the selection", () => {
    const lines = buildVisibleListLines(
      [
        {
          id: "playlist-tracks",
          title: "Na",
          items: [
            { id: "1", title: "A", subtitle: "artist", action: { type: "noop" } },
            { id: "2", title: "B", subtitle: "artist", action: { type: "noop" } },
            { id: "3", title: "C", subtitle: "artist", action: { type: "noop" } },
            { id: "4", title: "D", subtitle: "artist", action: { type: "noop" } },
            { id: "5", title: "E", subtitle: "artist", action: { type: "noop" } }
          ]
        }
      ],
      4,
      4
    );

    expect(lines).toEqual([
      { type: "item", item: expect.objectContaining({ title: "B" }), absoluteIndex: 2 },
      { type: "item", item: expect.objectContaining({ title: "C" }), absoluteIndex: 3 },
      { type: "item", item: expect.objectContaining({ title: "D" }), absoluteIndex: 4 },
      { type: "item", item: expect.objectContaining({ title: "E" }), absoluteIndex: 5 }
    ]);
  });

  test("list viewport can keep playlist section title out of scrolling rows", () => {
    const lines = buildVisibleListLines(
      [
        {
          id: "playlist-tracks",
          title: "Na",
          items: [
            { id: "1", title: "A", subtitle: "artist", action: { type: "noop" } },
            { id: "2", title: "B", subtitle: "artist", action: { type: "noop" } },
            { id: "3", title: "C", subtitle: "artist", action: { type: "noop" } },
            { id: "4", title: "D", subtitle: "artist", action: { type: "noop" } }
          ]
        }
      ],
      1,
      3,
      { stickySectionIds: ["playlist-tracks"] }
    );

    expect(lines).toEqual([
      { type: "item", item: expect.objectContaining({ title: "A" }), absoluteIndex: 1 },
      { type: "item", item: expect.objectContaining({ title: "B" }), absoluteIndex: 2 },
      { type: "item", item: expect.objectContaining({ title: "C" }), absoluteIndex: 3 }
    ]);
  });

  test("playlist detail header keeps title with metadata", () => {
    expect(
      formatPlaylistDetailHeader({
        id: "playlist-1",
        name: "Na",
        description: "",
        imageUrl: "",
        ownerName: "Allar Kalina",
        trackCount: 131,
        uri: "spotify:playlist:1",
        tracks: []
      })
    ).toBe("Na · Allar Kalina · 131 tracks");
  });

  test("top search bar keeps home and playlist prompts distinct", () => {
    const state = createInitialAuthenticatedAppState("");

    expect(getSearchPromptLine(state.homeSnapshot)).toBe(" What do you want to play?");
    expect(getSearchInputLine(state.browseState, state.homeSnapshot)).toBe(" Type [/] or press [enter] to search");
    expect(getTopBarHeight(state.browseState)).toBe(4);
    expect(
      getTopBarHeight({
        ...state.browseState,
        searchBusy: true,
        searchError: "nope"
      })
    ).toBe(6);
  });
});
