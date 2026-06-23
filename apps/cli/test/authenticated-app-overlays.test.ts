import { describe, expect, test } from "bun:test";
import { resolveAuthenticatedIntent } from "../src/authenticated-app-input";
import { createInitialAuthenticatedAppState } from "../src/authenticated-app-state";

describe("authenticated app overlays", () => {
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

  test("sort picker owns arrows enter and escape while open", () => {
    const state = {
      ...createInitialAuthenticatedAppState(""),
      sortPicker: {
        open: true,
        selectedIndex: 1
      }
    };

    expect(resolveAuthenticatedIntent(state, "", { downArrow: true })).toEqual({ type: "move-sort-selection", direction: "down" });
    expect(resolveAuthenticatedIntent(state, "", { upArrow: true })).toEqual({ type: "move-sort-selection", direction: "up" });
    expect(resolveAuthenticatedIntent(state, "", { return: true })).toEqual({ type: "submit-sort-selection" });
    expect(resolveAuthenticatedIntent(state, "", { escape: true })).toEqual({ type: "close-sort-picker" });
  });

  test("input modes resolve overlays before command prefix and search", () => {
    const overlayState = {
      ...createInitialAuthenticatedAppState(""),
      searchEditing: true,
      controlPrefixActive: true,
      devicePicker: {
        open: true,
        loading: false,
        devices: [],
        selectedIndex: 0
      },
      sortPicker: {
        open: true,
        selectedIndex: 1
      }
    };

    expect(resolveAuthenticatedIntent(overlayState, "s", { super: true })).toEqual({ type: "none" });
    expect(resolveAuthenticatedIntent(overlayState, "", { downArrow: true })).toEqual({
      type: "move-device-selection",
      direction: "down"
    });
    expect(resolveAuthenticatedIntent({ ...overlayState, devicePicker: { ...overlayState.devicePicker, open: false } }, "", { downArrow: true })).toEqual({
      type: "move-sort-selection",
      direction: "down"
    });
    expect(
      resolveAuthenticatedIntent(
        {
          ...overlayState,
          devicePicker: { ...overlayState.devicePicker, open: false },
          sortPicker: { ...overlayState.sortPicker, open: false }
        },
        "s",
        { super: true }
      )
    ).toEqual({ type: "activate-control-prefix" });
  });
});
