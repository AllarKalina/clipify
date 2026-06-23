import type { AuthenticatedAppState } from "./authenticated-app-state";

export type AuthenticatedInputKey = {
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
};

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
  | { type: "open-selected-context" }
  | { type: "toggle-playback" }
  | { type: "previous-track" }
  | { type: "next-track" }
  | { type: "toggle-shuffle"; enabled: boolean }
  | { type: "cycle-repeat"; mode: AuthenticatedAppState["homeSnapshot"]["repeatMode"] }
  | { type: "set-volume"; volumePercent: number }
  | { type: "start-link" }
  | { type: "open-sort-picker" }
  | { type: "relink-required" };
