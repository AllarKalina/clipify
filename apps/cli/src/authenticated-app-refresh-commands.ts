import { ApiClientError } from "@clipify/api-client";
import type { AuthenticatedAppState } from "./authenticated-app-state";
import type { AuthenticatedCommandContext } from "./authenticated-command-context";
import { formatBootstrapWarning, mapCliSnapshotToHome } from "./authenticated-app-data-mappers";
import { toMessage } from "./authenticated-app-utils";
import { applyProgressTick, reconcilePlayerDevice, type HomeSnapshot } from "./home-state";

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
          ? "Spotify permissions changed. Press [cmd+s] then [l] to re-link."
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

export function applyProgressPreview(state: AuthenticatedAppState) {
  return applyProgressTick(state.homeSnapshot, state.progressTickMs);
}
