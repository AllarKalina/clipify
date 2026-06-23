import type { ContentAction, ContentItem } from "./app-shell-types";
import { selectSelectedItem } from "./authenticated-app-selectors";
import type { AuthenticatedAppState } from "./authenticated-app-state";

export function canPlayContentAction(action: ContentAction | undefined): boolean {
  return action?.type === "play-track";
}

export function canOpenContentAction(action: ContentAction | undefined): boolean {
  return (
    action?.type === "open-playlist" ||
    action?.type === "open-liked-tracks" ||
    action?.type === "play-and-open-playlist" ||
    action?.type === "play-context"
  );
}

function isContentSelectionActive(state: AuthenticatedAppState): boolean {
  return state.focusRegion === "content" && state.contentIndex > 0;
}

export function canPlaySelectedTrack(state: AuthenticatedAppState): boolean {
  return isContentSelectionActive(state) && canPlayContentAction(selectSelectedItem(state)?.action);
}

export function canOpenSelectedContext(state: AuthenticatedAppState): boolean {
  return isContentSelectionActive(state) && canOpenContentAction(selectSelectedItem(state)?.action);
}

export function getPlaylistActionHint(selectedItem: ContentItem | null, focused: boolean): string {
  if (!focused) {
    return "";
  }

  const commandHints = [];
  if (canPlayContentAction(selectedItem?.action)) {
    commandHints.push("[p] play");
  }
  if (canOpenContentAction(selectedItem?.action)) {
    commandHints.push("[o] open");
  }
  commandHints.push("[a] sort");

  return `cmd+s ${commandHints.join("  ")}   esc back`;
}
