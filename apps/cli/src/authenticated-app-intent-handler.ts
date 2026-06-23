import type { Dispatch, MutableRefObject } from "react";
import {
  executeContentAction,
  executeOpenContextAction,
  logoutAuthenticatedApp,
  openDevicePicker,
  refreshAuthenticatedApp,
  runDeviceTransfer,
  runOptimisticPlayerModeAction,
  runPlaybackAction,
  startSpotifyLink,
  type AuthenticatedCommandContext
} from "./authenticated-app-commands";
import type { AuthenticatedIntent } from "./authenticated-app-input";
import { selectSelectedItem, selectSidebarItem } from "./authenticated-app-selectors";
import { getTrackSortLabel, TRACK_SORT_MODES } from "./app-shell-track-sorting";
import type { AuthenticatedAppAction, AuthenticatedAppState } from "./authenticated-app-state";

type HandleAuthenticatedIntentArgs = {
  intent: AuthenticatedIntent;
  state: AuthenticatedAppState;
  dispatch: Dispatch<AuthenticatedAppAction>;
  context: AuthenticatedCommandContext;
  onExit: () => void;
  playerModeMutationsInFlight: MutableRefObject<number>;
};

function leaveSearchEditing(state: AuthenticatedAppState, dispatch: Dispatch<AuthenticatedAppAction>) {
  if (state.searchEditing) {
    dispatch({ type: "set-search-editing", searchEditing: false });
  }
}

function trimSearchQueryWord(searchQuery: string) {
  return searchQuery.replace(/\s+$/, "").replace(/\S+$/, "");
}

export function handleAuthenticatedIntent({
  intent,
  state,
  dispatch,
  context,
  onExit,
  playerModeMutationsInFlight
}: HandleAuthenticatedIntentArgs): void {
  if (state.controlPrefixActive && intent.type !== "activate-control-prefix") {
    dispatch({ type: "set-control-prefix-active", controlPrefixActive: false });
  }

  switch (intent.type) {
    case "exit":
      onExit();
      return;
    case "none":
      return;
    case "close-device-picker":
      dispatch({ type: "close-device-picker" });
      return;
    case "move-device-selection":
      dispatch({ type: "move-device-selection", direction: intent.direction });
      return;
    case "submit-device-selection": {
      const selectedDevice = state.devicePicker.devices[state.devicePicker.selectedIndex];
      if (selectedDevice) {
        runDeviceTransfer(context, selectedDevice);
      }
      return;
    }
    case "close-sort-picker":
      dispatch({ type: "close-sort-picker" });
      return;
    case "move-sort-selection":
      dispatch({ type: "move-sort-selection", direction: intent.direction });
      return;
    case "submit-sort-selection": {
      const selectedSortMode = TRACK_SORT_MODES[state.sortPicker.selectedIndex] ?? state.browseState.trackSortMode;
      dispatch({ type: "submit-sort-selection" });
      dispatch({ type: "set-status-line", statusLine: `Track sort: ${getTrackSortLabel(selectedSortMode)}` });
      return;
    }
    case "toggle-focus":
      leaveSearchEditing(state, dispatch);
      dispatch({
        type: "set-focus-region",
        focusRegion: state.focusRegion === "sidebar" ? "content" : "sidebar"
      });
      return;
    case "move-sidebar-selection":
      leaveSearchEditing(state, dispatch);
      dispatch({ type: "move-sidebar-selection", direction: intent.direction });
      return;
    case "activate-sidebar-item": {
      const selectedSidebarItem = selectSidebarItem(state);
      if (selectedSidebarItem) {
        executeContentAction(context, selectedSidebarItem.action);
      }
      return;
    }
    case "set-focus-region":
      leaveSearchEditing(state, dispatch);
      dispatch({ type: "set-focus-region", focusRegion: intent.focusRegion });
      return;
    case "go-home":
      dispatch({ type: "reset-search" });
      dispatch({ type: "set-main-view", mainView: "home" });
      dispatch({ type: "set-focus-region", focusRegion: "content" });
      return;
    case "close-playlist-detail":
      dispatch({ type: "close-playlist-detail" });
      return;
    case "move-content-selection":
      leaveSearchEditing(state, dispatch);
      dispatch({ type: "move-content-selection", direction: intent.direction });
      return;
    case "set-content-index":
      if (intent.contentIndex !== 0) {
        leaveSearchEditing(state, dispatch);
      }
      dispatch({ type: "set-content-index", contentIndex: intent.contentIndex });
      return;
    case "activate-control-prefix":
      dispatch({ type: "set-control-prefix-active", controlPrefixActive: true });
      return;
    case "clear-control-prefix":
      dispatch({ type: "set-control-prefix-active", controlPrefixActive: false });
      return;
    case "start-search-editing":
      dispatch({ type: "set-focus-region", focusRegion: "content" });
      dispatch({ type: "set-content-index", contentIndex: 0 });
      dispatch({ type: "set-search-editing", searchEditing: true });
      return;
    case "start-search-editing-with-input":
      dispatch({ type: "set-focus-region", focusRegion: "content" });
      dispatch({ type: "set-content-index", contentIndex: 0 });
      dispatch({ type: "set-search-editing", searchEditing: true });
      dispatch({
        type: "set-search-query",
        searchQuery: `${state.browseState.searchQuery}${intent.value}`
      });
      return;
    case "relink-required":
      dispatch({
        type: "set-status-line",
        statusLine: "Spotify permissions changed. Press [cmd+s] then [l] to re-link before using Home or search."
      });
      return;
    case "stop-search-editing":
      if (!state.browseState.searchQuery.trim()) {
        dispatch({ type: "set-main-view", mainView: "home" });
      }
      dispatch({ type: "set-search-editing", searchEditing: false });
      return;
    case "submit-search-query":
      dispatch({ type: "submit-search-query" });
      return;
    case "append-search-query":
      dispatch({
        type: "set-search-query",
        searchQuery: `${state.browseState.searchQuery}${intent.value}`
      });
      return;
    case "trim-search-query":
      dispatch({ type: "set-search-editing", searchEditing: true });
      dispatch({
        type: "set-search-query",
        searchQuery: state.browseState.searchQuery.slice(0, -1)
      });
      return;
    case "trim-search-query-word":
      dispatch({ type: "set-search-editing", searchEditing: true });
      dispatch({
        type: "set-search-query",
        searchQuery: trimSearchQueryWord(state.browseState.searchQuery)
      });
      return;
    case "clear-search-query":
      dispatch({ type: "set-search-editing", searchEditing: true });
      dispatch({ type: "set-search-query", searchQuery: "" });
      return;
    case "logout":
      logoutAuthenticatedApp(context);
      return;
    case "open-device-picker":
      openDevicePicker(context);
      return;
    case "refresh":
      void refreshAuthenticatedApp(context, "Refreshed");
      return;
    case "open-sort-picker":
      dispatch({ type: "open-sort-picker" });
      return;
    case "activate-selected-item": {
      const selectedItem = selectSelectedItem(state);
      if (selectedItem) {
        executeContentAction(context, selectedItem.action);
      }
      return;
    }
    case "open-selected-context": {
      const selectedItem = selectSelectedItem(state);
      if (selectedItem) {
        executeOpenContextAction(context, selectedItem.action);
      }
      return;
    }
    case "toggle-playback":
      runPlaybackAction(
        context,
        state.homeSnapshot.playbackState === "playing" ? "Paused playback" : "Started playback",
        (targetClient) =>
          targetClient.runCliPlayerAction({
            action: state.homeSnapshot.playbackState === "playing" ? "pause" : "play"
          })
      );
      return;
    case "previous-track":
      runPlaybackAction(context, "Moved to previous track", (targetClient) =>
        targetClient.runCliPlayerAction({ action: "previous" })
      );
      return;
    case "next-track":
      runPlaybackAction(context, "Moved to next track", (targetClient) =>
        targetClient.runCliPlayerAction({ action: "next" })
      );
      return;
    case "toggle-shuffle":
      runOptimisticPlayerModeAction(
        context,
        playerModeMutationsInFlight,
        intent.enabled ? "Shuffle on" : "Shuffle off",
        { shuffleEnabled: intent.enabled },
        (targetClient) => targetClient.runCliPlayerAction({ action: "shuffle", enabled: intent.enabled })
      );
      return;
    case "cycle-repeat":
      runOptimisticPlayerModeAction(
        context,
        playerModeMutationsInFlight,
        `Repeat ${intent.mode === "context" ? "all" : intent.mode}`,
        { repeatMode: intent.mode },
        (targetClient) => targetClient.runCliPlayerAction({ action: "repeat", mode: intent.mode })
      );
      return;
    case "set-volume":
      runOptimisticPlayerModeAction(
        context,
        playerModeMutationsInFlight,
        `Volume ${intent.volumePercent}%`,
        { volumePercent: intent.volumePercent },
        (targetClient) => targetClient.runCliPlayerAction({ action: "volume", volumePercent: intent.volumePercent })
      );
      return;
    case "start-link":
      dispatch({ type: "set-busy", busy: true });
      void (async () => {
        try {
          await startSpotifyLink(context);
        } finally {
          dispatch({ type: "set-busy", busy: false });
        }
      })();
      return;
    default:
      return;
  }
}
