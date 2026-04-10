import { describe, expect, test } from "bun:test";
import { selectCanStartSearchEditing, selectShellViewModel } from "../src/authenticated-app-selectors";
import { createInitialAuthenticatedAppState } from "../src/authenticated-app-state";

describe("authenticated app selectors", () => {
  test("builds active sections from current page", () => {
    const state = {
      ...createInitialAuthenticatedAppState(""),
      browseState: {
        ...createInitialAuthenticatedAppState("").browseState,
        recentTracks: [
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
    };

    const viewModel = selectShellViewModel(state);
    expect(viewModel.activeSections[0]?.title).toBe("Recently played");
    expect(viewModel.selectedItem?.title).toBe("Dreams");
  });

  test("search editing starts only when search page has no active items", () => {
    const emptySearch = {
      ...createInitialAuthenticatedAppState(""),
      appPage: "search" as const
    };
    const populatedSearch = {
      ...emptySearch,
      browseState: {
        ...emptySearch.browseState,
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

    expect(selectCanStartSearchEditing(emptySearch)).toBeTrue();
    expect(selectCanStartSearchEditing(populatedSearch)).toBeFalse();
  });
});
