import {
  buildHomeSections,
  buildLibrarySections,
  buildPlaylistsSections,
  buildSearchSections,
  flattenSections,
  getPageLabel
} from "./app-shell-state";
import type { AuthenticatedAppState } from "./authenticated-app-state";

export function selectActiveSections(state: AuthenticatedAppState) {
  return state.appPage === "home"
    ? buildHomeSections(state.browseState)
    : state.appPage === "search"
      ? buildSearchSections(state.browseState)
      : state.appPage === "library"
        ? buildLibrarySections(state.browseState)
        : buildPlaylistsSections(state.browseState);
}

export function selectActiveItems(state: AuthenticatedAppState) {
  return flattenSections(selectActiveSections(state));
}

export function selectSelectedItem(state: AuthenticatedAppState) {
  return selectActiveItems(state)[state.contentIndex] ?? null;
}

export function selectCanStartSearchEditing(state: AuthenticatedAppState) {
  return state.appPage === "search" && selectActiveItems(state).length === 0;
}

export function selectInputBlocked(state: AuthenticatedAppState) {
  return state.busy;
}

export function selectShellViewModel(state: AuthenticatedAppState) {
  return {
    pageLabel: getPageLabel(state.appPage),
    activeSections: selectActiveSections(state),
    activeItems: selectActiveItems(state),
    selectedItem: selectSelectedItem(state),
    canStartSearchEditing: selectCanStartSearchEditing(state),
    inputBlocked: selectInputBlocked(state)
  };
}
