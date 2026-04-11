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
    expect(resolveAuthenticatedIntent(state, "", { return: true })).toEqual({ type: "activate-sidebar-item" });
  });

  test("maps transport keys to intents", () => {
    const state = createInitialAuthenticatedAppState("");

    expect(resolveAuthenticatedIntent(state, " ", {})).toEqual({ type: "toggle-playback" });
    expect(resolveAuthenticatedIntent(state, ",", {})).toEqual({ type: "previous-track" });
    expect(resolveAuthenticatedIntent(state, ".", {})).toEqual({ type: "next-track" });
  });
});
