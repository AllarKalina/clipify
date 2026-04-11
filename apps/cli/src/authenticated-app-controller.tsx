import type { ApiClient } from "@clipify/api-client";
import { useInput } from "ink";
import React, { useEffect, useMemo, useReducer, useRef } from "react";
import { AuthenticatedShell } from "./app-shell";
import { setPinnedPlaylistNameOverrides } from "./app-shell-state";
import {
  applyProgressPreview,
  executeContentAction,
  logoutAuthenticatedApp,
  openDevicePicker,
  refreshAuthenticatedApp,
  runDeviceTransfer,
  runOptimisticPlayerModeAction,
  runPlaybackAction,
  startSpotifyLink,
  type AuthenticatedCommandContext
} from "./authenticated-app-commands";
import { useAuthenticatedAppEffects } from "./authenticated-app-effects";
import { resolveAuthenticatedIntent } from "./authenticated-app-input";
import { selectSelectedItem, selectShellViewModel, selectSidebarItem } from "./authenticated-app-selectors";
import {
  authenticatedAppReducer,
  createInitialAuthenticatedAppState,
  type AuthenticatedAppState
} from "./authenticated-app-state";

type AuthenticatedAppControllerProps = {
  client: ApiClient;
  width: number;
  height: number;
  initialStatusLine: string;
  openBrowserOnLink: boolean;
  autoStartLink: boolean;
  pinnedPlaylistNames: string[];
  onLogoutComplete: (successLine: string) => void;
  onExit: () => void;
};

export function AuthenticatedAppController({
  client,
  width,
  height,
  initialStatusLine,
  openBrowserOnLink,
  autoStartLink,
  pinnedPlaylistNames,
  onLogoutComplete,
  onExit
}: AuthenticatedAppControllerProps) {
  const [state, dispatch] = useReducer(
    authenticatedAppReducer,
    initialStatusLine,
    createInitialAuthenticatedAppState
  );
  const stateRef = useRef<AuthenticatedAppState>(state);
  const backgroundRefreshInFlight = useRef(false);
  const playerModeMutationsInFlight = useRef(0);
  const autoLinkStarted = useRef(false);

  stateRef.current = state;

  const context = useMemo<AuthenticatedCommandContext>(
    () => ({
      client,
      dispatch,
      getState: () => stateRef.current,
      onLogoutComplete,
      openBrowserOnLink
    }),
    [client, dispatch, onLogoutComplete, openBrowserOnLink]
  );

  useAuthenticatedAppEffects({
    client,
    state,
    dispatch,
    context,
    autoStartLink,
    autoLinkStarted,
    backgroundRefreshInFlight,
    playerModeMutationsInFlight
  });

  const displayedHomeSnapshot = useMemo(() => applyProgressPreview(state), [state]);
  const shell = useMemo(() => selectShellViewModel(state), [state]);

  useEffect(() => {
    setPinnedPlaylistNameOverrides(pinnedPlaylistNames);
  }, [pinnedPlaylistNames]);

  useInput((input, key) => {
    const intent = resolveAuthenticatedIntent(state, input, key);

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
      case "toggle-focus":
        dispatch({
          type: "set-focus-region",
          focusRegion: state.focusRegion === "sidebar" ? "content" : "sidebar"
        });
        return;
      case "move-sidebar-selection":
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
        dispatch({ type: "set-focus-region", focusRegion: intent.focusRegion });
        return;
      case "go-home":
        dispatch({ type: "set-search-query", searchQuery: "" });
        dispatch({ type: "set-main-view", mainView: "home" });
        dispatch({ type: "set-focus-region", focusRegion: "content" });
        return;
      case "move-content-selection":
        dispatch({ type: "move-content-selection", direction: intent.direction });
        return;
      case "start-search-editing":
        dispatch({ type: "set-focus-region", focusRegion: "content" });
        dispatch({ type: "set-content-index", contentIndex: 0 });
        dispatch({ type: "set-search-editing", searchEditing: true });
        return;
      case "relink-required":
        dispatch({
          type: "set-status-line",
          statusLine: "Spotify permissions changed. Press [l] to re-link before using Home or search."
        });
        return;
      case "stop-search-editing":
        if (!state.browseState.searchQuery.trim()) {
          dispatch({ type: "set-main-view", mainView: "home" });
        }
        dispatch({ type: "set-search-editing", searchEditing: false });
        return;
      case "append-search-query":
        dispatch({
          type: "set-search-query",
          searchQuery: `${state.browseState.searchQuery}${intent.value}`
        });
        return;
      case "trim-search-query":
        dispatch({
          type: "set-search-query",
          searchQuery: state.browseState.searchQuery.slice(0, -1)
        });
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
      case "activate-selected-item": {
        const selectedItem = selectSelectedItem(state);
        if (selectedItem) {
          executeContentAction(context, selectedItem.action);
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
          playerModeMutationsInFlight.current ? playerModeMutationsInFlight : playerModeMutationsInFlight,
          intent.enabled ? "Shuffle on" : "Shuffle off",
          { shuffleEnabled: intent.enabled },
          (targetClient) => targetClient.runCliPlayerAction({ action: "shuffle", enabled: intent.enabled })
        );
        return;
      case "cycle-repeat":
        runOptimisticPlayerModeAction(
          context,
          playerModeMutationsInFlight.current ? playerModeMutationsInFlight : playerModeMutationsInFlight,
          `Repeat ${intent.mode === "context" ? "all" : intent.mode}`,
          { repeatMode: intent.mode },
          (targetClient) => targetClient.runCliPlayerAction({ action: "repeat", mode: intent.mode })
        );
        return;
      case "set-volume":
        runOptimisticPlayerModeAction(
          context,
          playerModeMutationsInFlight.current ? playerModeMutationsInFlight : playerModeMutationsInFlight,
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
  });

  return (
    <AuthenticatedShell
      mainView={state.mainView}
      focusRegion={state.focusRegion}
      sidebarItems={shell.sidebarItems}
      sidebarIndex={state.sidebarIndex}
      contentIndex={state.contentIndex}
      player={displayedHomeSnapshot}
      browse={state.browseState}
      sections={shell.activeSections}
      width={width}
      height={height}
      busy={state.busy}
      statusLine={state.statusLine}
      searchEditing={state.searchEditing}
      linkPending={Boolean(state.linkFlow)}
      devicePickerOpen={state.devicePicker.open}
      devicePickerDevices={state.devicePicker.devices}
      devicePickerIndex={state.devicePicker.selectedIndex}
      devicePickerLoading={state.devicePicker.loading}
    />
  );
}
