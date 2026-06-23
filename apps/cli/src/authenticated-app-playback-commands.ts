import type { ApiClient, SpotifyDeviceSummary } from "@clipify/api-client";
import type { AuthenticatedCommandContext } from "./authenticated-command-context";
import { refreshAuthenticatedApp, refreshAuthenticatedPlayerSilently } from "./authenticated-app-refresh-commands";
import { getPlaybackFailureMessage } from "./authenticated-app-utils";
import type { HomeSnapshot } from "./home-state";

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
