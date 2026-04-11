import {
  buildHomeSections,
  buildRelinkRequiredSidebarItems,
  buildLibrarySidebarItems,
  buildLikedTracksSections,
  buildPlaylistDetailSections,
  buildSearchSections,
  flattenSections,
  getMainViewLabel
} from "./app-shell-state";
import type { AuthenticatedAppState } from "./authenticated-app-state";

export function selectSidebarItems(state: AuthenticatedAppState) {
  if (state.homeSnapshot.spotify === "relink-required") {
    return buildRelinkRequiredSidebarItems();
  }

  return buildLibrarySidebarItems(state.browseState);
}

export function selectSidebarItem(state: AuthenticatedAppState) {
  return selectSidebarItems(state)[state.sidebarIndex] ?? null;
}

export function selectActiveSections(state: AuthenticatedAppState) {
  return state.mainView === "home"
    ? buildHomeSections(state.homeSnapshot, state.browseState)
    : state.mainView === "search-results"
      ? buildSearchSections(state.browseState)
      : state.mainView === "liked-tracks"
        ? buildLikedTracksSections(state.browseState)
        : buildPlaylistDetailSections(state.browseState);
}

export function selectActiveItems(state: AuthenticatedAppState) {
  return flattenSections(selectActiveSections(state));
}

export function selectSelectedItem(state: AuthenticatedAppState) {
  if (state.contentIndex === 0) {
    return null;
  }

  return selectActiveItems(state)[state.contentIndex - 1] ?? null;
}

export function selectCanStartSearchEditing(state: AuthenticatedAppState) {
  return state.homeSnapshot.spotify === "linked" && state.focusRegion === "content" && state.contentIndex === 0;
}

export function selectInputBlocked(state: AuthenticatedAppState) {
  return state.busy;
}

export function selectShellViewModel(state: AuthenticatedAppState) {
  return {
    mainLabel: getMainViewLabel(state.mainView),
    sidebarItems: selectSidebarItems(state),
    sidebarItem: selectSidebarItem(state),
    activeSections: selectActiveSections(state),
    activeItems: selectActiveItems(state),
    selectedItem: selectSelectedItem(state),
    canStartSearchEditing: selectCanStartSearchEditing(state),
    inputBlocked: selectInputBlocked(state)
  };
}
