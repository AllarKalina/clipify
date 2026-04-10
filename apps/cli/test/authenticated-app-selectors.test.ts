import { describe, expect, test } from "bun:test";
import { selectCanStartSearchEditing, selectShellViewModel } from "../src/authenticated-app-selectors";
import { createInitialAuthenticatedAppState } from "../src/authenticated-app-state";

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
    expect(viewModel.activeSections.map((section) => section.title)).toEqual(["Quick launch", "Picked for you"]);
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
    expect(viewModel.sidebarItems[0]?.title).toBe("Liked songs");
    expect(viewModel.sidebarItems[1]?.title).toBe("Roadtrip");
  });

  test("search bar is the only search-edit entry point", () => {
    const emptyMain = createInitialAuthenticatedAppState("");
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
});
