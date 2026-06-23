import { nextRepeatMode } from "./authenticated-app-utils";
import { selectCanStartSearchEditing, selectSelectedItem, selectSidebarItem } from "./authenticated-app-selectors";
import { getMainItemCount, type AuthenticatedAppState } from "./authenticated-app-state";
import { resolveHomeHorizontalMove, resolveHomeVerticalMove, resolveTrackJumpMove } from "./authenticated-app-navigation";

export type AuthenticatedIntent =
  | { type: "exit" }
  | { type: "none" }
  | { type: "close-device-picker" }
  | { type: "move-device-selection"; direction: "up" | "down" }
  | { type: "submit-device-selection" }
  | { type: "close-sort-picker" }
  | { type: "move-sort-selection"; direction: "up" | "down" }
  | { type: "submit-sort-selection" }
  | { type: "toggle-focus" }
  | { type: "set-focus-region"; focusRegion: "sidebar" | "content" }
  | { type: "move-sidebar-selection"; direction: "up" | "down" }
  | { type: "activate-sidebar-item" }
  | { type: "move-content-selection"; direction: "up" | "down" }
  | { type: "set-content-index"; contentIndex: number }
  | { type: "activate-control-prefix" }
  | { type: "clear-control-prefix" }
  | { type: "start-search-editing" }
  | { type: "start-search-editing-with-input"; value: string }
  | { type: "stop-search-editing" }
  | { type: "submit-search-query" }
  | { type: "append-search-query"; value: string }
  | { type: "trim-search-query" }
  | { type: "trim-search-query-word" }
  | { type: "clear-search-query" }
  | { type: "go-home" }
  | { type: "close-playlist-detail" }
  | { type: "logout" }
  | { type: "open-device-picker" }
  | { type: "refresh" }
  | { type: "activate-selected-item" }
  | { type: "toggle-playback" }
  | { type: "previous-track" }
  | { type: "next-track" }
  | { type: "toggle-shuffle"; enabled: boolean }
  | { type: "cycle-repeat"; mode: AuthenticatedAppState["homeSnapshot"]["repeatMode"] }
  | { type: "set-volume"; volumePercent: number }
  | { type: "start-link" }
  | { type: "open-sort-picker" }
  | { type: "relink-required" };

function isClearSearchInput(input: string, key: { ctrl?: boolean; super?: boolean; backspace?: boolean; delete?: boolean }) {
  return (key.super && (key.backspace || key.delete)) || (key.ctrl && input === "u");
}

function isTrimSearchInputWord(input: string, key: { ctrl?: boolean; meta?: boolean; backspace?: boolean; delete?: boolean }) {
  return (key.meta && (key.backspace || key.delete)) || (key.ctrl && input === "w");
}

function isControlPrefixInput(input: string, key: { meta?: boolean; super?: boolean }) {
  return input === "s" && (key.super || key.meta);
}

export function resolveAuthenticatedIntent(
  state: AuthenticatedAppState,
  input: string,
  key: {
    ctrl?: boolean;
    escape?: boolean;
    upArrow?: boolean;
    downArrow?: boolean;
    leftArrow?: boolean;
    rightArrow?: boolean;
    return?: boolean;
    backspace?: boolean;
    delete?: boolean;
    tab?: boolean;
    shift?: boolean;
    meta?: boolean;
    super?: boolean;
  }
): AuthenticatedIntent {
  if (key.ctrl && input === "c") {
    return { type: "exit" };
  }

  if (isControlPrefixInput(input, key)) {
    return { type: "activate-control-prefix" };
  }

  if (state.busy) {
    return { type: "none" };
  }

  if (state.devicePicker.open) {
    if (key.escape || input === "d") {
      return { type: "close-device-picker" };
    }

    if (key.upArrow) {
      return { type: "move-device-selection", direction: "up" };
    }

    if (key.downArrow) {
      return { type: "move-device-selection", direction: "down" };
    }

    if (key.return) {
      return { type: "submit-device-selection" };
    }

    return { type: "none" };
  }

  if (state.sortPicker.open) {
    if (key.escape) {
      return { type: "close-sort-picker" };
    }

    if (key.upArrow) {
      return { type: "move-sort-selection", direction: "up" };
    }

    if (key.downArrow) {
      return { type: "move-sort-selection", direction: "down" };
    }

    if (key.return) {
      return { type: "submit-sort-selection" };
    }

    return { type: "none" };
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
    if (key.return) {
      return { type: "submit-search-query" };
    }

    if (key.escape) {
      return { type: "none" };
    }

    if (isClearSearchInput(input, key)) {
      return { type: "clear-search-query" };
    }

    if (isTrimSearchInputWord(input, key)) {
      return { type: "trim-search-query-word" };
    }

    if (key.backspace || key.delete) {
      return { type: "trim-search-query" };
    }

    if (input && !key.ctrl && !key.meta && !key.super) {
      return { type: "append-search-query", value: input };
    }

    if (key.tab || key.upArrow || key.downArrow || key.leftArrow || key.rightArrow) {
      return resolveAuthenticatedIntent({ ...state, searchEditing: false }, input, key);
    }

    return { type: "none" };
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

    if ((input === "/" || key.return) && selectCanStartSearchEditing(state)) {
      return key.return && state.browseState.searchQuery.trim() ? { type: "submit-search-query" } : { type: "start-search-editing" };
    }

    if ((input === "/" || key.return) && state.homeSnapshot.spotify === "relink-required") {
      return { type: "relink-required" };
    }

    if (key.return && selectSelectedItem(state)) {
      return { type: "activate-selected-item" };
    }

    if (selectCanStartSearchEditing(state)) {
      if (isClearSearchInput(input, key)) {
        return { type: "clear-search-query" };
      }

      if (isTrimSearchInputWord(input, key)) {
        return { type: "trim-search-query-word" };
      }

      if (key.backspace || key.delete) {
        return { type: "trim-search-query" };
      }
    }

    if (input && !key.ctrl && !key.meta && !key.super && selectCanStartSearchEditing(state)) {
      return { type: "start-search-editing-with-input", value: input };
    }
  }

  return { type: "none" };
}
