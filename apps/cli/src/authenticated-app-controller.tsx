import type { ApiClient } from "@clipify/api-client";
import { useInput } from "ink";
import React, { useMemo, useReducer, useRef } from "react";
import { AuthenticatedShell } from "./app-shell";
import {
  applyProgressPreview,
  type AuthenticatedCommandContext
} from "./authenticated-app-commands";
import { useAuthenticatedAppEffects } from "./authenticated-app-effects";
import { handleAuthenticatedIntent } from "./authenticated-app-intent-handler";
import { resolveAuthenticatedIntent } from "./authenticated-app-input";
import { selectShellViewModel } from "./authenticated-app-selectors";
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
    { initialStatusLine, pinnedPlaylistNames },
    ({ initialStatusLine, pinnedPlaylistNames }) =>
      createInitialAuthenticatedAppState(initialStatusLine, pinnedPlaylistNames)
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

  useInput((input, key) => {
    const intent = resolveAuthenticatedIntent(state, input, key);
    handleAuthenticatedIntent({
      intent,
      state,
      dispatch,
      context,
      onExit,
      playerModeMutationsInFlight
    });
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
