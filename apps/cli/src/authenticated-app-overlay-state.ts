import type { SpotifyDeviceSummary } from "@clipify/api-client";
import { moveSelection, TRACK_SORT_MODES, type ShellBrowseState } from "./app-shell-state";
import { findTrackContentIndex, getSelectedTrackUri, withBrowseState } from "./authenticated-app-list-state";
import type { AuthenticatedAppState, DevicePickerState, SortPickerState } from "./authenticated-app-state";
import { clampDeviceSelection } from "./device-picker-state";

export type OverlayStateAction =
  | { type: "open-sort-picker" }
  | { type: "close-sort-picker" }
  | { type: "move-sort-selection"; direction: "up" | "down" }
  | { type: "submit-sort-selection" }
  | { type: "open-device-picker" }
  | { type: "close-device-picker" }
  | { type: "set-device-picker-loading"; loading: boolean }
  | { type: "set-device-list"; devices: SpotifyDeviceSummary[] }
  | { type: "move-device-selection"; direction: "up" | "down" };

export function createInitialDevicePickerState(): DevicePickerState {
  return {
    open: false,
    loading: false,
    devices: [],
    selectedIndex: 0
  };
}

export function createInitialSortPickerState(): SortPickerState {
  return {
    open: false,
    selectedIndex: 0
  };
}

function getTrackSortIndex(state: AuthenticatedAppState): number {
  return Math.max(0, TRACK_SORT_MODES.indexOf(state.browseState.trackSortMode));
}

function withTrackSortMode(state: AuthenticatedAppState, trackSortMode: ShellBrowseState["trackSortMode"]): AuthenticatedAppState {
  const selectedTrackUri = getSelectedTrackUri(state);
  const nextState = withBrowseState(state, {
    ...state.browseState,
    trackSortMode
  });
  const nextContentIndex = selectedTrackUri ? findTrackContentIndex(nextState, selectedTrackUri) : null;

  return nextContentIndex !== null ? { ...nextState, contentIndex: nextContentIndex } : nextState;
}

export function reduceOverlayState(state: AuthenticatedAppState, action: OverlayStateAction): AuthenticatedAppState {
  switch (action.type) {
    case "open-sort-picker":
      return { ...state, sortPicker: { open: true, selectedIndex: getTrackSortIndex(state) } };
    case "close-sort-picker":
      return { ...state, sortPicker: { ...state.sortPicker, open: false } };
    case "move-sort-selection":
      return {
        ...state,
        sortPicker: {
          ...state.sortPicker,
          selectedIndex: moveSelection(state.sortPicker.selectedIndex, action.direction, TRACK_SORT_MODES.length)
        }
      };
    case "submit-sort-selection":
      return {
        ...withTrackSortMode(state, TRACK_SORT_MODES[state.sortPicker.selectedIndex] ?? state.browseState.trackSortMode),
        sortPicker: { ...state.sortPicker, open: false }
      };
    case "open-device-picker":
      return {
        ...state,
        devicePicker: {
          ...state.devicePicker,
          open: true
        }
      };
    case "close-device-picker":
      return {
        ...state,
        devicePicker: {
          ...state.devicePicker,
          open: false,
          loading: false
        }
      };
    case "set-device-picker-loading":
      return {
        ...state,
        devicePicker: {
          ...state.devicePicker,
          loading: action.loading
        }
      };
    case "set-device-list":
      return {
        ...state,
        devicePicker: {
          ...state.devicePicker,
          devices: action.devices,
          selectedIndex: clampDeviceSelection(state.devicePicker.selectedIndex, action.devices.length)
        }
      };
    case "move-device-selection":
      return {
        ...state,
        devicePicker: {
          ...state.devicePicker,
          selectedIndex: moveSelection(state.devicePicker.selectedIndex, action.direction, state.devicePicker.devices.length)
        }
      };
  }
}
