import {
  ApiClientError,
  type ApiClient,
  type CliLibraryViewResponse,
  type CliPlayerSnapshotResponse,
  type SpotifyDeviceSummary
} from "@clipify/api-client";
import type { Dispatch } from "react";
import type { ContentAction, PlaylistDetail, ShellBrowseState, TrackSummary } from "./app-shell-state";
import type { AuthenticatedAppAction, AuthenticatedAppState, LinkFlow } from "./authenticated-app-state";
import { openUrl } from "./browser";
import { applyProgressTick, reconcilePlayerDevice, type HomeSnapshot } from "./home-state";
import { getPlaybackFailureMessage, toMessage } from "./authenticated-app-utils";

export type AuthenticatedCommandContext = {
  client: ApiClient;
  dispatch: Dispatch<AuthenticatedAppAction>;
  getState: () => AuthenticatedAppState;
  onLogoutComplete: (successLine: string) => void;
  openBrowserOnLink: boolean;
};

function formatBootstrapWarning(warning: string): string {
  if (!warning) {
    return warning;
  }

  if (!warning.includes("|")) {
    return warning;
  }

  return "Spotify returned partial data. Press [r] to refresh.";
}

function mapCliSnapshotToHome(
  snapshotHome: CliPlayerSnapshotResponse["home"]
): HomeSnapshot {
  return {
    backend: "connected",
    spotify: snapshotHome.spotify,
    userName: snapshotHome.userName,
    userEmail: snapshotHome.userEmail,
    spotifyDisplayName: snapshotHome.spotifyDisplayName,
    deviceId: snapshotHome.deviceId,
    deviceName: snapshotHome.deviceName,
    deviceType: snapshotHome.deviceType,
    deviceStatus: snapshotHome.deviceStatus,
    supportsVolume: snapshotHome.supportsVolume,
    volumePercent: snapshotHome.volumePercent,
    playbackState: snapshotHome.playbackState,
    shuffleEnabled: snapshotHome.shuffleEnabled,
    repeatMode: snapshotHome.repeatMode,
    trackName: snapshotHome.trackName,
    artistName: snapshotHome.artistName,
    albumName: snapshotHome.albumName,
    progressMs: snapshotHome.progressMs,
    durationMs: snapshotHome.durationMs,
    queueStatus: snapshotHome.queueStatus,
    queue: snapshotHome.queue,
    recentUnavailable: snapshotHome.recentUnavailable,
    recent: snapshotHome.recent
  };
}

function toTrackSummary(item: NonNullable<CliLibraryViewResponse["section"]>["items"][number]): TrackSummary {
  return {
    id: item.id,
    trackName: item.title,
    artistName: item.subtitle,
    albumName: item.meta ?? "",
    uri: item.action.uri,
    durationMs: 0
  };
}

function toPlaylistDetail(section: NonNullable<CliLibraryViewResponse["section"]>, current: ShellBrowseState, playlistId: string): PlaylistDetail {
  const playlist = current.playlists.find((item) => item.id === playlistId);
  const tracks = section.items.map(toTrackSummary);

  return {
    id: playlist?.id ?? playlistId,
    name: playlist?.name ?? section.title,
    description: playlist?.description ?? "",
    imageUrl: playlist?.imageUrl ?? "",
    ownerName: playlist?.ownerName ?? "",
    isPinned: playlist?.isPinned,
    trackCount: playlist?.trackCount ?? tracks.length,
    uri: playlist?.uri ?? "",
    tracks
  };
}

async function loadLibrarySection(client: ApiClient, libraryId: string) {
  return client.getCliLibraryView(libraryId);
}

export async function refreshAuthenticatedApp(
  context: AuthenticatedCommandContext,
  successLine: string
): Promise<HomeSnapshot> {
  const { client, dispatch, getState, onLogoutComplete } = context;
  dispatch({ type: "set-busy", busy: true });

  try {
    const bootstrap = await client.getCliBootstrap();
    const next = mapCliSnapshotToHome(bootstrap.home);

    dispatch({ type: "replace-home-snapshot", snapshot: next });
    dispatch({
      type: "replace-browse-state",
      browseState: {
        ...getState().browseState,
        recentTracks: next.recent,
        featuredPlaylists: bootstrap.browse.featuredPlaylists,
        playlists: bootstrap.browse.playlists,
        likedTracks: bootstrap.browse.likedTracks
      }
    });
    dispatch({ type: "reset-progress-tick" });

    if (next.spotify === "linked") {
      try {
        const nextDevices = (await client.getCliDevices()).items;
        dispatch({ type: "set-device-list", devices: nextDevices });
        dispatch({
          type: "replace-home-snapshot",
          snapshot: reconcilePlayerDevice(next, nextDevices)
        });
      } catch {}
    }

    dispatch({
      type: "set-status-line",
      statusLine:
        next.spotify === "relink-required"
          ? "Spotify permissions changed. Press [l] to re-link."
          : formatBootstrapWarning(bootstrap.warning) || successLine
    });
    dispatch({ type: "set-busy", busy: false });
    return next;
  } catch (error) {
    dispatch({ type: "set-busy", busy: false });
    if (error instanceof ApiClientError && error.status === 401) {
      onLogoutComplete("Session expired");
      return {
        ...getState().homeSnapshot,
        failureReason: "unauthorized"
      };
    }

    dispatch({ type: "set-status-line", statusLine: `Refresh failed: ${toMessage(error)}` });
    return {
      ...getState().homeSnapshot,
      backend: "offline",
      error: toMessage(error)
    };
  }
}

export async function refreshAuthenticatedPlayerSilently(context: AuthenticatedCommandContext): Promise<void> {
  const { client, dispatch, onLogoutComplete } = context;

  try {
    const snapshot = await client.getCliPlayerSnapshot();
    const next = mapCliSnapshotToHome(snapshot.home);
    dispatch({ type: "replace-home-snapshot", snapshot: next });
    dispatch({ type: "patch-browse-state", patch: { recentTracks: next.recent } });
    dispatch({ type: "reset-progress-tick" });
  } catch (error) {
    if (error instanceof ApiClientError && error.status === 401) {
      onLogoutComplete("Session expired");
    }
  }
}

export async function startSpotifyLink(context: AuthenticatedCommandContext) {
  const { client, dispatch, openBrowserOnLink } = context;

  try {
    const start = await client.startCliAuthorization();
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

  void (async () => {
    try {
      const response = await client.getCliDevices();
      dispatch({ type: "set-device-list", devices: response.items });
    } catch (error) {
      dispatch({ type: "set-status-line", statusLine: `Device list failed: ${toMessage(error)}` });
    } finally {
      dispatch({ type: "set-device-picker-loading", loading: false });
    }
  })();
}

export function runPlaybackAction(
  context: AuthenticatedCommandContext,
  label: string,
  action: (targetClient: ApiClient) => Promise<unknown>
) {
  const { client, dispatch, getState } = context;
  dispatch({ type: "set-busy", busy: true });

  void (async () => {
    try {
      await action(client);
      await refreshAuthenticatedApp(context, label);
    } catch (error) {
      dispatch({ type: "set-busy", busy: false });
      dispatch({ type: "set-status-line", statusLine: getPlaybackFailureMessage(error, label, getState().homeSnapshot) });
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
      dispatch({ type: "set-status-line", statusLine: getPlaybackFailureMessage(error, label, context.getState().homeSnapshot) });
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
      await client.runCliPlayerAction({ action: "transfer", deviceId: device.id });
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
  const { client, dispatch, getState } = context;

  if (action.type === "noop") {
    return;
  }

  if (action.type === "open-liked-tracks") {
    dispatch({ type: "set-busy", busy: true });
    void loadLibrarySection(client, "liked")
      .then((detail) => {
        if (!detail.section) {
          throw new Error("Liked songs view not available");
        }

        dispatch({
          type: "patch-browse-state",
          patch: {
            likedTracks: detail.section.items.map(toTrackSummary)
          }
        });
        dispatch({ type: "open-liked-tracks" });
        dispatch({ type: "set-status-line", statusLine: "Opened Liked songs" });
      })
      .catch((error) => {
        dispatch({ type: "set-status-line", statusLine: `Liked songs load failed: ${toMessage(error)}` });
      })
      .finally(() => {
        dispatch({ type: "set-busy", busy: false });
      });
    return;
  }

  if (action.type === "open-playlist") {
    dispatch({ type: "set-busy", busy: true });
    void loadLibrarySection(client, action.playlistId)
      .then((detail) => {
        if (!detail.section) {
          throw new Error("Playlist view not available");
        }

        dispatch({
          type: "open-playlist-detail",
          detail: toPlaylistDetail(detail.section, getState().browseState, action.playlistId)
        });
        dispatch({ type: "set-status-line", statusLine: `Opened ${detail.section.title}` });
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
    runPlaybackAction(context, "Started track", (targetClient) =>
      targetClient.runCliPlayerAction({ action: "play-track", uri: action.uri })
    );
    return;
  }

  if (action.type === "play-context") {
    runPlaybackAction(context, "Started context", (targetClient) =>
      targetClient.runCliPlayerAction({ action: "play-context", contextUri: action.uri })
    );
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
