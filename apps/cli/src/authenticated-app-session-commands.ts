import type { AuthenticatedCommandContext } from "./authenticated-command-context";
import type { LinkFlow } from "./authenticated-app-state";
import { openUrl } from "./browser";
import { toMessage } from "./authenticated-app-utils";

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
