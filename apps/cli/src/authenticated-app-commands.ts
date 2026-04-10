import type { ApiClient, SpotifyDeviceSummary } from "@clipify/api-client";
import type { Dispatch } from "react";
import type { ContentAction, ShellBrowseState } from "./app-shell-state";
import type { AuthenticatedAppAction, AuthenticatedAppState, LinkFlow } from "./authenticated-app-state";
import { openUrl } from "./browser";
import {
  applyProgressTick,
  computeHomeSnapshot,
  refreshPlayerSnapshot,
  type HomeSnapshot
} from "./home-state";
import { getPlaybackFailureMessage, toMessage } from "./authenticated-app-utils";

export type AuthenticatedCommandContext = {
  client: ApiClient;
  dispatch: Dispatch<AuthenticatedAppAction>;
  getState: () => AuthenticatedAppState;
  onLogoutComplete: (successLine: string) => void;
  openBrowserOnLink: boolean;
};

function getBrowseWarning(
  featured: PromiseSettledResult<unknown>,
  playlists: PromiseSettledResult<unknown>,
  liked: PromiseSettledResult<unknown>
): string {
  const failures = [
    featured.status === "rejected" ? `featured picks: ${toMessage(featured.reason)}` : null,
    playlists.status === "rejected" ? `playlists: ${toMessage(playlists.reason)}` : null,
    liked.status === "rejected" ? `liked songs: ${toMessage(liked.reason)}` : null
  ].filter(Boolean);

  return failures.length > 0 ? `Browse data incomplete: ${failures.join(" | ")}` : "";
}

async function loadBrowseShellWithStatus(client: ApiClient, current: ShellBrowseState) {
  const [featured, playlists, liked] = await Promise.allSettled([
    client.getSpotifyFeaturedPlaylists(),
    client.getSpotifyPlaylists(),
    client.getSpotifySavedTracks()
  ]);

  return {
    browseState: {
      ...current,
      featuredPlaylists: featured.status === "fulfilled" ? featured.value.items : current.featuredPlaylists,
      playlists: playlists.status === "fulfilled" ? playlists.value.items : current.playlists,
      likedTracks: liked.status === "fulfilled" ? liked.value.items : current.likedTracks
    },
    warning: getBrowseWarning(featured, playlists, liked)
  };
}

async function loadPlaylistDetail(client: ApiClient, playlistId: string) {
  return client.getSpotifyPlaylist(playlistId);
}

export async function refreshAuthenticatedApp(
  context: AuthenticatedCommandContext,
  successLine: string
): Promise<HomeSnapshot> {
  const { client, dispatch, getState, onLogoutComplete } = context;
  dispatch({ type: "set-busy", busy: true });
  const next = await computeHomeSnapshot(client);
  if (next.failureReason === "unauthorized") {
    onLogoutComplete("Session expired");
    return next;
  }

  dispatch({ type: "replace-home-snapshot", snapshot: next });
  dispatch({ type: "reset-progress-tick" });
  dispatch({ type: "set-busy", busy: false });
  dispatch({
    type: "set-status-line",
    statusLine: next.backend === "connected" ? successLine : "Backend unreachable or unauthorized"
  });

  if (next.backend === "connected" && next.spotify === "linked") {
    try {
      const nextDevices = (await client.getSpotifyDevices()).items;
      dispatch({ type: "set-device-list", devices: nextDevices });
    } catch {}

    try {
      const loadedBrowse = await loadBrowseShellWithStatus(client, {
        ...getState().browseState,
        recentTracks: next.recent
      });
      dispatch({ type: "replace-browse-state", browseState: loadedBrowse.browseState });
      if (loadedBrowse.warning) {
        dispatch({ type: "set-status-line", statusLine: loadedBrowse.warning });
      }
    } catch {}
  }

  return next;
}

export async function refreshAuthenticatedPlayerSilently(context: AuthenticatedCommandContext): Promise<void> {
  const { client, dispatch, getState, onLogoutComplete } = context;
  const next = await refreshPlayerSnapshot(client, getState().homeSnapshot);
  if (next.failureReason === "unauthorized") {
    onLogoutComplete("Session expired");
    return;
  }

  if (next.backend !== "connected") {
    return;
  }

  dispatch({ type: "replace-home-snapshot", snapshot: next });
  dispatch({ type: "reset-progress-tick" });
}

export async function startSpotifyLink(context: AuthenticatedCommandContext) {
  const { client, dispatch, openBrowserOnLink } = context;

  try {
    const start = await client.startSpotifyAuthorization();
    dispatch({ type: "set-link-flow", linkFlow: start as LinkFlow });

    if (openBrowserOnLink) {
      const opened = openUrl(start.authorizeUrl);
      dispatch({
        type: "set-status-line",
        statusLine: opened
          ? "Opened Spotify auth in browser. Waiting for callback..."
          : "Could not open browser. Open authorize URL manually."
      });
    } else {
      dispatch({
        type: "set-status-line",
        statusLine: "Open authorize URL in a browser. Waiting for callback..."
      });
    }
  } catch (error) {
    dispatch({ type: "set-status-line", statusLine: `Link start failed: ${toMessage(error)}` });
  }
}

export function openDevicePicker(context: AuthenticatedCommandContext) {
  const { client, dispatch } = context;

  dispatch({ type: "open-device-picker" });
  dispatch({ type: "set-device-picker-loading", loading: true });

  void client
    .getSpotifyDevices()
    .then(({ items }) => {
      dispatch({ type: "set-device-list", devices: items });
    })
    .catch((error) => {
      dispatch({ type: "set-status-line", statusLine: `Device list failed: ${toMessage(error)}` });
    })
    .finally(() => {
      dispatch({ type: "set-device-picker-loading", loading: false });
    });
}

export function runPlaybackAction(
  context: AuthenticatedCommandContext,
  label: string,
  action: (targetClient: ApiClient) => Promise<unknown>
) {
  const { client, dispatch } = context;
  dispatch({ type: "set-busy", busy: true });

  void (async () => {
    try {
      await action(client);
      await refreshAuthenticatedApp(context, label);
    } catch (error) {
      dispatch({ type: "set-busy", busy: false });
      dispatch({ type: "set-status-line", statusLine: getPlaybackFailureMessage(error, label) });
    }
  })();
}

export function runOptimisticPlayerModeAction(
  context: AuthenticatedCommandContext,
  mutationState: { current: number },
  label: string,
  patch: Partial<HomeSnapshot>,
  action: (targetClient: ApiClient) => Promise<unknown>
) {
  const { client, dispatch } = context;

  mutationState.current += 1;
  dispatch({ type: "patch-home-snapshot", patch });
  dispatch({ type: "set-status-line", statusLine: label });

  void (async () => {
    try {
      await action(client);
    } catch (error) {
      mutationState.current = Math.max(0, mutationState.current - 1);
      await refreshAuthenticatedPlayerSilently(context);
      dispatch({ type: "set-status-line", statusLine: getPlaybackFailureMessage(error, label) });
      return;
    }

    mutationState.current = Math.max(0, mutationState.current - 1);
    if (mutationState.current > 0) {
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 300));
    await refreshAuthenticatedPlayerSilently(context);
  })();
}

export function runDeviceTransfer(
  context: AuthenticatedCommandContext,
  device: SpotifyDeviceSummary
) {
  const { client, dispatch } = context;

  if (device.isRestricted) {
    dispatch({
      type: "set-status-line",
      statusLine: `${device.name} is restricted and cannot be controlled from Clipify.`
    });
    return;
  }

  dispatch({ type: "set-busy", busy: true });

  void (async () => {
    try {
      await client.transferSpotifyPlayback(device.id);
      dispatch({ type: "close-device-picker" });
      await refreshAuthenticatedApp(context, `Device ready: ${device.name}`);
    } catch (error) {
      dispatch({ type: "set-busy", busy: false });
      dispatch({
        type: "set-status-line",
        statusLine: getPlaybackFailureMessage(error, "Device transfer")
      });
    }
  })();
}

export function executeContentAction(
  context: AuthenticatedCommandContext,
  action: ContentAction
) {
  const { client, dispatch } = context;

  if (action.type === "noop") {
    return;
  }

  if (action.type === "open-liked-tracks") {
    dispatch({ type: "open-liked-tracks" });
    return;
  }

  if (action.type === "open-playlist") {
    dispatch({ type: "set-busy", busy: true });
    void loadPlaylistDetail(client, action.playlistId)
      .then((detail) => {
        dispatch({ type: "open-playlist-detail", detail });
        dispatch({ type: "set-status-line", statusLine: `Opened ${detail.name}` });
      })
      .catch((error) => {
        dispatch({ type: "set-status-line", statusLine: `Playlist load failed: ${toMessage(error)}` });
      })
      .finally(() => {
        dispatch({ type: "set-busy", busy: false });
      });
    return;
  }

  if (action.type === "play-track") {
    runPlaybackAction(context, "Started track", (targetClient) => targetClient.playSpotifyTrack(action.uri));
    return;
  }

  if (action.type === "play-context") {
    runPlaybackAction(context, "Started context", (targetClient) => targetClient.playSpotifyContext(action.uri));
  }
}

export function logoutAuthenticatedApp(context: AuthenticatedCommandContext) {
  const { client, dispatch, onLogoutComplete } = context;
  dispatch({ type: "set-busy", busy: true });
  void (async () => {
    try {
      await client.signOut();
      onLogoutComplete("Logged out");
    } catch (error) {
      dispatch({ type: "set-busy", busy: false });
      dispatch({ type: "set-status-line", statusLine: `Logout failed: ${toMessage(error)}` });
    }
  })();
}

export function applyProgressPreview(state: AuthenticatedAppState) {
  return applyProgressTick(state.homeSnapshot, state.progressTickMs);
}
