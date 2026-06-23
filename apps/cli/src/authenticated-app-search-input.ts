import { selectCanStartSearchEditing } from "./authenticated-app-selectors";
import type { AuthenticatedAppState } from "./authenticated-app-state";
import type { AuthenticatedInputKey, AuthenticatedIntent } from "./authenticated-app-input-types";

function isClearSearchInput(input: string, key: AuthenticatedInputKey) {
  return (key.super && (key.backspace || key.delete)) || (key.ctrl && input === "u");
}

function isTrimSearchInputWord(input: string, key: AuthenticatedInputKey) {
  return (key.meta && (key.backspace || key.delete)) || (key.ctrl && input === "w");
}

export function resolveActiveSearchInputIntent(input: string, key: AuthenticatedInputKey): AuthenticatedIntent {
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
    return { type: "stop-search-editing" };
  }

  return { type: "none" };
}

export function resolveSearchEntryIntent(
  state: AuthenticatedAppState,
  input: string,
  key: AuthenticatedInputKey
): AuthenticatedIntent | null {
  const canStartSearchEditing = selectCanStartSearchEditing(state);

  if ((input === "/" || key.return) && canStartSearchEditing) {
    return key.return && state.browseState.searchQuery.trim() ? { type: "submit-search-query" } : { type: "start-search-editing" };
  }

  if ((input === "/" || key.return) && state.homeSnapshot.spotify === "relink-required") {
    return { type: "relink-required" };
  }

  if (canStartSearchEditing) {
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
      return { type: "start-search-editing-with-input", value: input };
    }
  }

  return null;
}
