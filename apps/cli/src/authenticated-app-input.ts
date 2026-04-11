import { nextRepeatMode } from "./authenticated-app-utils";
import { selectCanStartSearchEditing, selectSelectedItem, selectSidebarItem } from "./authenticated-app-selectors";
import { getMainItemCount, type AuthenticatedAppState } from "./authenticated-app-state";

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
  | { type: "set-content-index"; contentIndex: number }
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

function getHomeTileSectionCounts(state: AuthenticatedAppState): number[] {
  if (state.mainView !== "home" || state.homeSnapshot.spotify !== "linked") {
    return [];
  }

  return [Math.min(6, state.browseState.playlists.length), Math.min(6, state.browseState.featuredPlaylists.length)].filter(
    (count) => count > 0
  );
}

function locateHomeTile(sectionCounts: number[], contentIndex: number) {
  if (contentIndex <= 0) {
    return null;
  }

  const absoluteZeroBased = contentIndex - 1;
  let sectionStart = 0;

  for (let sectionIndex = 0; sectionIndex < sectionCounts.length; sectionIndex += 1) {
    const sectionCount = sectionCounts[sectionIndex] ?? 0;
    const sectionEnd = sectionStart + sectionCount;
    if (absoluteZeroBased < sectionEnd) {
      return {
        sectionIndex,
        sectionStart,
        sectionCount,
        localIndex: absoluteZeroBased - sectionStart
      };
    }
    sectionStart = sectionEnd;
  }

  return null;
}

function resolveHomeVerticalMove(state: AuthenticatedAppState, direction: "up" | "down"): number | null {
  const sectionCounts = getHomeTileSectionCounts(state);
  const position = locateHomeTile(sectionCounts, state.contentIndex);
  if (!position) {
    return null;
  }

  const { sectionIndex, sectionStart, sectionCount, localIndex } = position;
  const column = localIndex % 2;

  if (direction === "down") {
    const nextInSection = localIndex + 2;
    if (nextInSection < sectionCount) {
      return sectionStart + nextInSection + 1;
    }

    for (let nextSection = sectionIndex + 1; nextSection < sectionCounts.length; nextSection += 1) {
      const nextCount = sectionCounts[nextSection] ?? 0;
      let nextStart = 0;
      for (let i = 0; i < nextSection; i += 1) {
        nextStart += sectionCounts[i] ?? 0;
      }
      const nextLocalIndex = Math.min(column, nextCount - 1);
      return nextStart + nextLocalIndex + 1;
    }

    return null;
  }

  const previousInSection = localIndex - 2;
  if (previousInSection >= 0) {
    return sectionStart + previousInSection + 1;
  }

  for (let previousSection = sectionIndex - 1; previousSection >= 0; previousSection -= 1) {
    const previousCount = sectionCounts[previousSection] ?? 0;
    let previousStart = 0;
    for (let i = 0; i < previousSection; i += 1) {
      previousStart += sectionCounts[i] ?? 0;
    }

    const previousLastRowStart = Math.floor((previousCount - 1) / 2) * 2;
    const previousLocalIndex = Math.min(previousLastRowStart + column, previousCount - 1);
    return previousStart + previousLocalIndex + 1;
  }

  return null;
}

function resolveHomeHorizontalMove(state: AuthenticatedAppState, direction: "left" | "right"): number | null {
  const sectionCounts = getHomeTileSectionCounts(state);
  const position = locateHomeTile(sectionCounts, state.contentIndex);
  if (!position) {
    return null;
  }

  const { sectionStart, sectionCount, localIndex } = position;
  const isRightColumn = localIndex % 2 === 1;

  if (direction === "left" && isRightColumn) {
    return sectionStart + localIndex;
  }

  if (direction === "right" && !isRightColumn && localIndex + 1 < sectionCount) {
    return sectionStart + localIndex + 2;
  }

  return null;
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
      const lastIndex = getMainItemCount(state) - 1;
      if (lastIndex >= 1 && state.contentIndex <= 2) {
        return { type: "set-content-index", contentIndex: 0 };
      }

      const verticalTarget = resolveHomeVerticalMove(state, "up");
      if (verticalTarget !== null) {
        return { type: "set-content-index", contentIndex: verticalTarget };
      }
      return { type: "move-content-selection", direction: "up" };
    }

    if (key.downArrow) {
      const lastIndex = getMainItemCount(state) - 1;
      if (lastIndex >= 1 && state.contentIndex >= Math.max(1, lastIndex - 1)) {
        return { type: "none" };
      }

      const verticalTarget = resolveHomeVerticalMove(state, "down");
      if (verticalTarget !== null) {
        return { type: "set-content-index", contentIndex: verticalTarget };
      }
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
