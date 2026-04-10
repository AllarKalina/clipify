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

  test("starts search editing from empty search page", () => {
    const state = {
      ...createInitialAuthenticatedAppState(""),
      appPage: "search" as const,
      focusRegion: "content" as const
    };

    expect(resolveAuthenticatedIntent(state, "/", {})).toEqual({ type: "start-search-editing" });
  });

  test("maps transport keys to intents", () => {
    const state = createInitialAuthenticatedAppState("");

    expect(resolveAuthenticatedIntent(state, " ", {})).toEqual({ type: "toggle-playback" });
    expect(resolveAuthenticatedIntent(state, ",", {})).toEqual({ type: "previous-track" });
    expect(resolveAuthenticatedIntent(state, ".", {})).toEqual({ type: "next-track" });
  });
});
