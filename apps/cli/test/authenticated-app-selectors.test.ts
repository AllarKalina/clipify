import { describe, expect, test } from "bun:test";
import { selectCanStartSearchEditing, selectShellViewModel } from "../src/authenticated-app-selectors";
import { createInitialAuthenticatedAppState } from "../src/authenticated-app-state";
import { getNextTrackSortMode, getTrackSortLabel } from "../src/app-shell-state";
import {
  buildVisibleListLines,
  formatPlaylistDetailHeader,
  formatTrackRow,
  getBodyListAvailableLines,
  getListItemRenderKey,
  getListScrollMargin,
  shouldRenderMainViewLabel
} from "../src/app-page-body";
import { clipSearchInputLabel, getSearchInputLine, getSearchPromptLine, getTopBarHeight } from "../src/app-top-bar";

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
      type: "play-and-open-playlist",
      playlistId: "playlist-1",
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

  test("sorts playlist detail tracks by newest added date", () => {
    const state = {
      ...createInitialAuthenticatedAppState(""),
      mainView: "playlist-detail" as const,
      browseState: {
        ...createInitialAuthenticatedAppState("").browseState,
        trackSortMode: "added" as const,
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
              trackName: "Middle",
              artistName: "Fleetwood Mac",
              albumName: "Rumours",
              uri: "spotify:track:1",
              durationMs: 257000,
              addedAt: "2026-02-02T12:00:00Z"
            },
            {
              id: "track-2",
              trackName: "Newest",
              artistName: "Fleetwood Mac",
              albumName: "Rumours",
              uri: "spotify:track:2",
              durationMs: 257000,
              addedAt: "2026-02-03T12:00:00Z"
            },
            {
              id: "track-3",
              trackName: "Oldest",
              artistName: "Fleetwood Mac",
              albumName: "Rumours",
              uri: "spotify:track:3",
              durationMs: 257000,
              addedAt: "2026-02-01T12:00:00Z"
            }
          ]
        }
      }
    };

    const viewModel = selectShellViewModel(state);
    expect(viewModel.activeSections[0]?.items.map((item) => item.title)).toEqual(["Newest", "Middle", "Oldest"]);
    expect(getTrackSortLabel(state.browseState.trackSortMode)).toBe("recent");
    expect(getNextTrackSortMode("added")).toBe("title");
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

  test("list viewport gives the active playlist row breathing room while scrolling", () => {
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
            { id: "5", title: "E", subtitle: "artist", action: { type: "noop" } },
            { id: "6", title: "F", subtitle: "artist", action: { type: "noop" } },
            { id: "7", title: "G", subtitle: "artist", action: { type: "noop" } }
          ]
        }
      ],
      4,
      4,
      { stickySectionIds: ["playlist-tracks"] }
    );

    expect(getListScrollMargin(4)).toBe(1);
    expect(lines).toEqual([
      { type: "item", item: expect.objectContaining({ title: "C" }), absoluteIndex: 3 },
      { type: "item", item: expect.objectContaining({ title: "D" }), absoluteIndex: 4 },
      { type: "item", item: expect.objectContaining({ title: "E" }), absoluteIndex: 5 },
      { type: "item", item: expect.objectContaining({ title: "F" }), absoluteIndex: 6 }
    ]);
  });

  test("body list height accounts for borders and sticky playlist header", () => {
    expect(getBodyListAvailableLines(37, true)).toBe(33);
    expect(getBodyListAvailableLines(37, false)).toBe(35);
    expect(getBodyListAvailableLines(3, true)).toBe(1);
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
    const playlistDetail = {
      id: "playlist-1",
      name: "Na",
      description: "",
      imageUrl: "",
      ownerName: "Allar Kalina",
      trackCount: 131,
      uri: "spotify:playlist:1",
      tracks: []
    };

    expect(shouldRenderMainViewLabel("playlist-detail", playlistDetail)).toBeFalse();
    expect(
      formatPlaylistDetailHeader(playlistDetail)
    ).toBe(" Na · Allar Kalina · 131 tracks");
  });

  test("track rows separate title from artist metadata", () => {
    const wide = formatTrackRow(
      {
        id: "track-1",
        title: "I Wanna Dance with Somebody (Who Loves Me)",
        subtitle: "Whitney Houston",
        meta: "Whitney",
        action: { type: "noop" }
      },
      7,
      80
    );

    expect(wide.indexLabel).toBe("07");
    expect(wide.title.trimEnd()).toBe("I Wanna Dance with Somebody (Who Loves Me)");
    expect(wide.metadata.trimEnd()).toBe("Whitney Houston");

    const narrow = formatTrackRow(
      {
        id: "track-1",
        title: "I Wanna Dance with Somebody (Who Loves Me)",
        subtitle: "Whitney Houston",
        meta: "Whitney",
        action: { type: "noop" }
      },
      7,
      30
    );

    expect(narrow.metadata).toBe("");
    expect(narrow.title.trimEnd()).toBe("I Wanna Dance with Some…");
  });

  test("list item render keys stay unique for duplicate spotify tracks", () => {
    const repeatedTrack = {
      id: "track-american-pie",
      title: "American Pie",
      subtitle: "Don McLean",
      action: { type: "noop" as const }
    };

    expect(getListItemRenderKey(repeatedTrack, 12)).toBe("item-12-track-american-pie");
    expect(getListItemRenderKey(repeatedTrack, 12)).not.toBe(getListItemRenderKey(repeatedTrack, 13));
  });

  test("top search bar stays compact", () => {
    const state = createInitialAuthenticatedAppState("");

    expect(getSearchPromptLine(state.homeSnapshot)).toBe(" Search Spotify");
    expect(getSearchInputLine(state.browseState, state.homeSnapshot)).toBe(" Search Spotify");
    expect(getSearchInputLine(state.browseState, state.homeSnapshot, true)).toBe(" ");
    expect(clipSearchInputLabel("sadads dsadssd", 40)).toBe("sadads dsadssd");
    expect(clipSearchInputLabel("sadads dsadssd", 8)).toBe("sadads …");
    expect(getTopBarHeight(state.browseState)).toBe(3);
    expect(
      getTopBarHeight({
        ...state.browseState,
        searchBusy: true,
        searchError: "nope"
      })
    ).toBe(5);
  });
});
