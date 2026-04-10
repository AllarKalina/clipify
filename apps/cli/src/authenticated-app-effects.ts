import type { ApiClient } from "@clipify/api-client";
import { useEffect, type Dispatch, type MutableRefObject } from "react";
import type { AuthenticatedAppAction, AuthenticatedAppState } from "./authenticated-app-state";
import type { AuthenticatedCommandContext } from "./authenticated-app-commands";
import {
  refreshAuthenticatedApp,
  refreshAuthenticatedPlayerSilently,
  startSpotifyLink
} from "./authenticated-app-commands";
import { shouldBackgroundRefresh, shouldTickPlayback } from "./home-state";
import { toMessage } from "./authenticated-app-utils";

const homeBackgroundRefreshMs = 5000;

type AuthenticatedEffectsProps = {
  client: ApiClient;
  state: AuthenticatedAppState;
  dispatch: Dispatch<AuthenticatedAppAction>;
  context: AuthenticatedCommandContext;
  autoStartLink: boolean;
  autoLinkStarted: MutableRefObject<boolean>;
  backgroundRefreshInFlight: MutableRefObject<boolean>;
  playerModeMutationsInFlight: MutableRefObject<number>;
};

export function useAuthenticatedAppEffects({
  client,
  state,
  dispatch,
  context,
  autoStartLink,
  autoLinkStarted,
  backgroundRefreshInFlight,
  playerModeMutationsInFlight
}: AuthenticatedEffectsProps) {
  useEffect(() => {
    void refreshAuthenticatedApp(context, "Refreshed");
  }, [context]);

  useEffect(() => {
    if (!autoStartLink || autoLinkStarted.current) {
      return;
    }

    if (state.homeSnapshot.spotify !== "not-linked" || state.linkFlow) {
      return;
    }

    autoLinkStarted.current = true;
    dispatch({
      type: "set-status-line",
      statusLine: `${state.statusLine || "Session ready"}. Starting Spotify link...`
    });
    void startSpotifyLink(context);
  }, [autoStartLink, autoLinkStarted, context, dispatch, state.homeSnapshot.spotify, state.linkFlow, state.statusLine]);

  useEffect(() => {
    if (state.appPage !== "search" || !state.browseState.searchQuery.trim()) {
      return;
    }

    const timeout = setTimeout(() => {
      dispatch({ type: "search-started" });

      void client
        .searchSpotify(state.browseState.searchQuery.trim())
        .then((results) => {
          dispatch({ type: "search-completed", results });
          dispatch({ type: "set-content-index", contentIndex: 0 });
        })
        .catch((error) => {
          dispatch({ type: "search-failed", error: toMessage(error) });
        });
    }, 250);

    return () => clearTimeout(timeout);
  }, [client, dispatch, state.appPage, state.browseState.searchQuery]);

  useEffect(() => {
    dispatch({ type: "reset-progress-tick" });
  }, [
    dispatch,
    state.homeSnapshot.trackName,
    state.homeSnapshot.artistName,
    state.homeSnapshot.albumName,
    state.homeSnapshot.progressMs,
    state.homeSnapshot.durationMs,
    state.homeSnapshot.playbackState
  ]);

  useEffect(() => {
    if (!shouldTickPlayback(state.homeSnapshot)) {
      return;
    }

    const interval = setInterval(() => {
      dispatch({ type: "advance-progress-tick", amountMs: 1000 });
    }, 1000);

    return () => clearInterval(interval);
  }, [dispatch, state.homeSnapshot]);

  useEffect(() => {
    if (state.linkFlow || state.busy || !shouldBackgroundRefresh(state.homeSnapshot)) {
      return;
    }

    const interval = setInterval(() => {
      if (backgroundRefreshInFlight.current || playerModeMutationsInFlight.current > 0) {
        return;
      }

      backgroundRefreshInFlight.current = true;
      void refreshAuthenticatedPlayerSilently(context).finally(() => {
        backgroundRefreshInFlight.current = false;
      });
    }, homeBackgroundRefreshMs);

    return () => clearInterval(interval);
  }, [backgroundRefreshInFlight, context, playerModeMutationsInFlight, state.busy, state.homeSnapshot, state.linkFlow]);

  useEffect(() => {
    if (!state.linkFlow) {
      return;
    }

    const interval = setInterval(() => {
      void (async () => {
        try {
          const status = await client.getSpotifyAuthorizationStatus();
          if (!status.linked) {
            return;
          }

          dispatch({ type: "set-status-line", statusLine: "Spotify linked" });
          dispatch({ type: "set-link-flow", linkFlow: null });
          await refreshAuthenticatedApp(context, "Refreshed");
        } catch (error) {
          dispatch({ type: "set-status-line", statusLine: `Link status failed: ${toMessage(error)}` });
        }
      })();
    }, 1500);

    return () => clearInterval(interval);
  }, [client, context, dispatch, state.linkFlow]);
}
