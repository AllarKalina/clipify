import type { AuthenticatedAppState } from "./authenticated-app-state";
import type { AuthenticatedInputKey, AuthenticatedIntent } from "./authenticated-app-input-types";

export function resolveOverlayIntent(
  state: AuthenticatedAppState,
  input: string,
  key: AuthenticatedInputKey
): AuthenticatedIntent | null {
  if (state.devicePicker.open) {
    if (key.escape || input === "d") {
      return { type: "close-device-picker" };
    }

    if (key.upArrow) {
      return { type: "move-device-selection", direction: "up" };
    }

    if (key.downArrow) {
      return { type: "move-device-selection", direction: "down" };
    }

    if (key.return) {
      return { type: "submit-device-selection" };
    }

    return { type: "none" };
  }

  if (state.sortPicker.open) {
    if (key.escape) {
      return { type: "close-sort-picker" };
    }

    if (key.upArrow) {
      return { type: "move-sort-selection", direction: "up" };
    }

    if (key.downArrow) {
      return { type: "move-sort-selection", direction: "down" };
    }

    if (key.return) {
      return { type: "submit-sort-selection" };
    }

    return { type: "none" };
  }

  return null;
}
