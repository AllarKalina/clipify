import { nextRepeatMode } from "./authenticated-app-utils";
import { selectSelectedItem, selectSidebarItem } from "./authenticated-app-selectors";
import { getMainItemCount } from "./authenticated-app-list-state";
import type { AuthenticatedAppState } from "./authenticated-app-state";
import { resolveHomeHorizontalMove, resolveHomeVerticalMove, resolveTrackJumpMove } from "./authenticated-app-navigation";
import { resolveOverlayIntent } from "./authenticated-app-overlays";
import { resolveActiveSearchInputIntent, resolveSearchEntryIntent } from "./authenticated-app-search-input";
import type { AuthenticatedInputKey, AuthenticatedIntent } from "./authenticated-app-input-types";

export type { AuthenticatedInputKey, AuthenticatedIntent } from "./authenticated-app-input-types";

function isControlPrefixInput(input: string, key: AuthenticatedInputKey) {
  return input === "s" && (key.super || key.meta);
}

export function resolveAuthenticatedIntent(
  state: AuthenticatedAppState,
  input: string,
  key: AuthenticatedInputKey
): AuthenticatedIntent {
  if (key.ctrl && input === "c") {
    return { type: "exit" };
  }

  if (state.busy) {
    return { type: "none" };
  }

  const overlayIntent = resolveOverlayIntent(state, input, key);
  if (overlayIntent) {
    return overlayIntent;
  }

  if (isControlPrefixInput(input, key)) {
    return { type: "activate-control-prefix" };
  }

  if (state.controlPrefixActive) {
    if (key.escape) {
      return { type: "clear-control-prefix" };
    }

    if (input === "q") {
      return { type: "exit" };
    }

    if (input === "h") {
      return { type: "go-home" };
    }

    if (input === "o") {
      return { type: "logout" };
    }

    if (input === "d") {
      return { type: "open-device-picker" };
    }

    if (input === "r") {
      return { type: "refresh" };
    }

    if (input === " ") {
      return { type: "toggle-playback" };
    }

    if (input === ",") {
      return { type: "previous-track" };
    }

    if (input === ".") {
      return { type: "next-track" };
    }

    if (input === "s") {
      return { type: "toggle-shuffle", enabled: !state.homeSnapshot.shuffleEnabled };
    }

    if (input === "t") {
      return { type: "cycle-repeat", mode: nextRepeatMode(state.homeSnapshot.repeatMode) };
    }

    if (input === "-" || input === "_") {
      return {
        type: "set-volume",
        volumePercent: Math.max(0, state.homeSnapshot.volumePercent - 10)
      };
    }

    if (input === "=" || input === "+") {
      return {
        type: "set-volume",
        volumePercent: Math.min(100, state.homeSnapshot.volumePercent + 10)
      };
    }

    if (input === "l") {
      return { type: "start-link" };
    }

    if (input === "a" && (state.mainView === "playlist-detail" || state.mainView === "liked-tracks")) {
      return { type: "open-sort-picker" };
    }

    return resolveAuthenticatedIntent({ ...state, controlPrefixActive: false }, input, key);
  }

  if (state.searchEditing) {
    const searchIntent = resolveActiveSearchInputIntent(input, key);
    if (searchIntent.type === "stop-search-editing") {
      return resolveAuthenticatedIntent({ ...state, searchEditing: false }, input, key);
    }
    return searchIntent;
  }

  if (key.tab) {
    return { type: "toggle-focus" };
  }

  if (key.escape && state.mainView === "playlist-detail" && state.focusRegion === "content") {
    return { type: "close-playlist-detail" };
  }

  if (key.escape && state.mainView !== "home" && state.mainView !== "playlist-detail") {
    return { type: "go-home" };
  }

  if (state.focusRegion === "sidebar") {
    if (key.rightArrow) {
      return { type: "set-focus-region", focusRegion: "content" };
    }

    if (key.upArrow) {
      return { type: "move-sidebar-selection", direction: "up" };
    }

    if (key.downArrow) {
      return { type: "move-sidebar-selection", direction: "down" };
    }

    if (key.return && selectSidebarItem(state)) {
      return { type: "activate-sidebar-item" };
    }
  }

  if (state.focusRegion === "content") {
    if (key.leftArrow || key.rightArrow) {
      const horizontalTarget = resolveHomeHorizontalMove(state, key.leftArrow ? "left" : "right");
      if (horizontalTarget !== null) {
        return { type: "set-content-index", contentIndex: horizontalTarget };
      }
    }

    if (key.leftArrow) {
      return { type: "set-focus-region", focusRegion: "sidebar" };
    }

    if (key.upArrow) {
      if (key.shift) {
        const jumpTarget = resolveTrackJumpMove(state, "up");
        if (jumpTarget !== null) {
          return jumpTarget === state.contentIndex ? { type: "none" } : { type: "set-content-index", contentIndex: jumpTarget };
        }
      }

      const lastIndex = getMainItemCount(state) - 1;
      const searchJumpThreshold = state.mainView === "home" ? 2 : 1;
      if (lastIndex >= 1 && state.contentIndex <= searchJumpThreshold) {
        return { type: "set-content-index", contentIndex: 0 };
      }

      const verticalTarget = resolveHomeVerticalMove(state, "up");
      if (verticalTarget !== null) {
        return { type: "set-content-index", contentIndex: verticalTarget };
      }
      return { type: "move-content-selection", direction: "up" };
    }

    if (key.downArrow) {
      if (key.shift) {
        const jumpTarget = resolveTrackJumpMove(state, "down");
        if (jumpTarget !== null) {
          return jumpTarget === state.contentIndex ? { type: "none" } : { type: "set-content-index", contentIndex: jumpTarget };
        }
      }

      const lastIndex = getMainItemCount(state) - 1;
      const lastReachableIndex = state.mainView === "home" ? Math.max(1, lastIndex - 1) : lastIndex;
      if (lastIndex >= 1 && state.contentIndex >= lastReachableIndex) {
        return { type: "none" };
      }

      const verticalTarget = resolveHomeVerticalMove(state, "down");
      if (verticalTarget !== null) {
        return { type: "set-content-index", contentIndex: verticalTarget };
      }
      return { type: "move-content-selection", direction: "down" };
    }

    if (key.return && selectSelectedItem(state)) {
      return { type: "activate-selected-item" };
    }

    const searchEntryIntent = resolveSearchEntryIntent(state, input, key);
    if (searchEntryIntent) {
      return searchEntryIntent;
    }
  }

  return { type: "none" };
}
