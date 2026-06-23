import { getMainItemCount } from "./authenticated-app-list-state";
import type { AuthenticatedAppState } from "./authenticated-app-state";

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

export function resolveHomeVerticalMove(state: AuthenticatedAppState, direction: "up" | "down"): number | null {
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

export function resolveHomeHorizontalMove(state: AuthenticatedAppState, direction: "left" | "right"): number | null {
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

export function resolveTrackJumpMove(state: AuthenticatedAppState, direction: "up" | "down", step = 5): number | null {
  if (state.mainView !== "playlist-detail" && state.mainView !== "liked-tracks") {
    return null;
  }

  const lastIndex = getMainItemCount(state) - 1;
  if (lastIndex < 1 || state.contentIndex < 1) {
    return null;
  }

  const delta = direction === "down" ? step : -step;
  return Math.max(1, Math.min(lastIndex, state.contentIndex + delta));
}
