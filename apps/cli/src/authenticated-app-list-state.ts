import {
  buildHomeSections,
  buildLibrarySidebarItems,
  buildLikedTracksSections,
  buildPlaylistDetailSections,
  buildSearchSections
} from "./app-shell-sections";
import { flattenSections } from "./app-shell-navigation";
import type { ShellBrowseState } from "./app-shell-types";
import type { AuthenticatedAppState } from "./authenticated-app-state";

function buildMainSections(state: AuthenticatedAppState) {
  return state.mainView === "home"
    ? buildHomeSections(state.homeSnapshot, state.browseState)
    : state.mainView === "search-results"
      ? buildSearchSections(state.browseState)
      : state.mainView === "liked-tracks"
        ? buildLikedTracksSections(state.browseState)
        : buildPlaylistDetailSections(state.browseState);
}

export function getSidebarItemCount(state: AuthenticatedAppState): number {
  return buildLibrarySidebarItems(state.browseState, state.browseState.pinnedPlaylistNames).length;
}

export function getMainItemCount(state: AuthenticatedAppState): number {
  return 1 + flattenSections(buildMainSections(state)).length;
}

export function clampSelection(current: number, count: number): number {
  if (count <= 0) {
    return 0;
  }

  return Math.min(Math.max(0, current), count - 1);
}

export function withBrowseState(state: AuthenticatedAppState, browseState: ShellBrowseState): AuthenticatedAppState {
  const nextState = {
    ...state,
    browseState
  };

  return {
    ...nextState,
    sidebarIndex: clampSelection(state.sidebarIndex, getSidebarItemCount(nextState)),
    contentIndex: clampSelection(state.contentIndex, getMainItemCount(nextState))
  };
}

export function getSelectedTrackUri(state: AuthenticatedAppState): string | null {
  if (state.contentIndex <= 0) {
    return null;
  }

  const selectedItem = flattenSections(buildMainSections(state))[state.contentIndex - 1];
  return selectedItem?.action.type === "play-track" ? selectedItem.action.uri : null;
}

export function findTrackContentIndex(state: AuthenticatedAppState, uri: string): number | null {
  const itemIndex = flattenSections(buildMainSections(state)).findIndex(
    (item) => item.action.type === "play-track" && item.action.uri === uri
  );

  return itemIndex >= 0 ? itemIndex + 1 : null;
}
