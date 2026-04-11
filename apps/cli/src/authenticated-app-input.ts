import { nextRepeatMode } from "./authenticated-app-utils";
import { selectCanStartSearchEditing, selectSelectedItem, selectSidebarItem } from "./authenticated-app-selectors";
import type { AuthenticatedAppState } from "./authenticated-app-state";

export type AuthenticatedIntent =
  | { type: "exit" }
  | { type: "none" }
  | { type: "close-device-picker" }
  | { type: "move-device-selection"; direction: "up" | "down" }
  | { type: "submit-device-selection" }
  | { type: "toggle-focus" }
  | { type: "set-focus-region"; focusRegion: "sidebar" | "content" }
  | { type: "move-sidebar-selection"; direction: "up" | "down" }
  | { type: "activate-sidebar-item" }
  | { type: "move-content-selection"; direction: "up" | "down" }
  | { type: "start-search-editing" }
  | { type: "stop-search-editing" }
  | { type: "append-search-query"; value: string }
  | { type: "trim-search-query" }
  | { type: "go-home" }
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
  | { type: "relink-required" };

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
  }
): AuthenticatedIntent {
  if (key.ctrl && input === "c") {
    return { type: "exit" };
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

  if (state.searchEditing) {
    if (key.escape || key.return) {
      return { type: "stop-search-editing" };
    }

    if (key.backspace || key.delete) {
      return { type: "trim-search-query" };
    }

    if (input && !key.ctrl) {
      return { type: "append-search-query", value: input };
    }

    return { type: "none" };
  }

  if (input === "q") {
    return { type: "exit" };
  }

  if (key.tab) {
    return { type: "toggle-focus" };
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

  if (state.focusRegion === "sidebar") {
    if (key.upArrow) {
      return { type: "move-sidebar-selection", direction: "up" };
    }

    if (key.downArrow) {
      return { type: "move-sidebar-selection", direction: "down" };
    }

    if ((key.return || key.rightArrow) && selectSidebarItem(state)) {
      return { type: "activate-sidebar-item" };
    }
  }

  if (state.focusRegion === "content") {
    if (key.leftArrow) {
      return { type: "set-focus-region", focusRegion: "sidebar" };
    }

    if (key.upArrow) {
      return { type: "move-content-selection", direction: "up" };
    }

    if (key.downArrow) {
      return { type: "move-content-selection", direction: "down" };
    }

    if ((input === "/" || key.return) && selectCanStartSearchEditing(state)) {
      return { type: "start-search-editing" };
    }

    if ((input === "/" || key.return) && state.homeSnapshot.spotify === "relink-required") {
      return { type: "relink-required" };
    }

    if (key.return && selectSelectedItem(state)) {
      return { type: "activate-selected-item" };
    }
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

  return { type: "none" };
}
