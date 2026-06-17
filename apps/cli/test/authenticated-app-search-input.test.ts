import { describe, expect, test } from "bun:test";
import { resolveAuthenticatedIntent } from "../src/authenticated-app-input";
import { createInitialAuthenticatedAppState } from "../src/authenticated-app-state";

describe("authenticated app search input", () => {
  test("starts search editing from the main search bar", () => {
    const state = {
      ...createInitialAuthenticatedAppState(""),
      focusRegion: "content" as const,
      contentIndex: 0,
      homeSnapshot: {
        ...createInitialAuthenticatedAppState("").homeSnapshot,
        backend: "connected" as const,
        spotify: "linked" as const
      }
    };

    expect(resolveAuthenticatedIntent(state, "/", {})).toEqual({ type: "start-search-editing" });
    expect(resolveAuthenticatedIntent(state, "", { return: true })).toEqual({ type: "start-search-editing" });
  });

  test("active search captures printable input and only enter submits", () => {
    const state = {
      ...createInitialAuthenticatedAppState(""),
      searchEditing: true,
      focusRegion: "content" as const,
      contentIndex: 0
    };

    expect(resolveAuthenticatedIntent(state, "h", {})).toEqual({ type: "append-search-query", value: "h" });
    expect(resolveAuthenticatedIntent(state, "7", {})).toEqual({ type: "append-search-query", value: "7" });
    expect(resolveAuthenticatedIntent(state, " ", {})).toEqual({ type: "append-search-query", value: " " });
    expect(resolveAuthenticatedIntent(state, "", { return: true })).toEqual({ type: "submit-search-query" });
    expect(resolveAuthenticatedIntent(state, "", { escape: true })).toEqual({ type: "none" });
  });

  test("typing on the selected search row starts editing with that input", () => {
    const state = {
      ...createInitialAuthenticatedAppState(""),
      focusRegion: "content" as const,
      contentIndex: 0,
      homeSnapshot: {
        ...createInitialAuthenticatedAppState("").homeSnapshot,
        backend: "connected" as const,
        spotify: "linked" as const
      }
    };

    expect(resolveAuthenticatedIntent(state, "h", {})).toEqual({ type: "start-search-editing-with-input", value: "h" });
    expect(resolveAuthenticatedIntent(state, "7", {})).toEqual({ type: "start-search-editing-with-input", value: "7" });
    expect(resolveAuthenticatedIntent(state, "s", {})).toEqual({ type: "start-search-editing-with-input", value: "s" });
  });

  test("selected search row keeps terminal input controls available after navigation", () => {
    const state = {
      ...createInitialAuthenticatedAppState(""),
      searchEditing: false,
      focusRegion: "content" as const,
      contentIndex: 0,
      homeSnapshot: {
        ...createInitialAuthenticatedAppState("").homeSnapshot,
        backend: "connected" as const,
        spotify: "linked" as const
      },
      browseState: {
        ...createInitialAuthenticatedAppState("").browseState,
        searchQuery: "hello world"
      }
    };

    expect(resolveAuthenticatedIntent(state, "", { backspace: true })).toEqual({ type: "trim-search-query" });
    expect(resolveAuthenticatedIntent(state, "", { delete: true })).toEqual({ type: "trim-search-query" });
    expect(resolveAuthenticatedIntent(state, "", { meta: true, backspace: true })).toEqual({ type: "trim-search-query-word" });
    expect(resolveAuthenticatedIntent(state, "", { super: true, backspace: true })).toEqual({ type: "clear-search-query" });
    expect(resolveAuthenticatedIntent(state, "", { return: true })).toEqual({ type: "submit-search-query" });
  });

  test("active search supports terminal-style modified backspace", () => {
    const state = {
      ...createInitialAuthenticatedAppState(""),
      searchEditing: true,
      focusRegion: "content" as const,
      contentIndex: 0
    };

    expect(resolveAuthenticatedIntent(state, "", { meta: true, backspace: true })).toEqual({ type: "trim-search-query-word" });
    expect(resolveAuthenticatedIntent(state, "", { super: true, backspace: true })).toEqual({ type: "clear-search-query" });
  });

  test("active search exits through navigation intents", () => {
    const state = {
      ...createInitialAuthenticatedAppState(""),
      searchEditing: true,
      focusRegion: "content" as const,
      contentIndex: 0,
      browseState: {
        ...createInitialAuthenticatedAppState("").browseState,
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
      },
      mainView: "search-results" as const
    };

    expect(resolveAuthenticatedIntent(state, "", { tab: true })).toEqual({ type: "toggle-focus" });
    expect(resolveAuthenticatedIntent(state, "", { leftArrow: true })).toEqual({ type: "set-focus-region", focusRegion: "sidebar" });
    expect(resolveAuthenticatedIntent(state, "", { downArrow: true })).toEqual({ type: "move-content-selection", direction: "down" });
  });

  test("blocks search editing when spotify relink is required", () => {
    const state = {
      ...createInitialAuthenticatedAppState(""),
      focusRegion: "content" as const,
      contentIndex: 0,
      homeSnapshot: {
        ...createInitialAuthenticatedAppState("").homeSnapshot,
        backend: "connected" as const,
        spotify: "relink-required" as const
      }
    };

    expect(resolveAuthenticatedIntent(state, "/", {})).toEqual({ type: "relink-required" });
    expect(resolveAuthenticatedIntent(state, "", { return: true })).toEqual({ type: "relink-required" });
  });
});
