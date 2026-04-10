import type { SpotifyDeviceSummary } from "@clipify/api-client";
import {
  buildHomeSections,
  buildLibrarySections,
  buildPlaylistsSections,
  buildSearchSections,
  createInitialShellBrowseState,
  flattenSections,
  moveSelection,
  type AppFocusRegion,
  type AppPage,
  type PlaylistDetail,
  type SearchResults,
  type ShellBrowseState
} from "./app-shell-state";
import { clampDeviceSelection } from "./device-picker-state";
import {
  createPendingAuthenticatedHomeSnapshot,
  type HomeSnapshot
} from "./home-state";

export type LinkFlow = {
  authorizeUrl: string;
};

export type DevicePickerState = {
  open: boolean;
  loading: boolean;
  devices: SpotifyDeviceSummary[];
  selectedIndex: number;
};

export type AuthenticatedAppState = {
  homeSnapshot: HomeSnapshot;
  progressTickMs: number;
  appPage: AppPage;
  focusRegion: AppFocusRegion;
  contentIndex: number;
  browseState: ShellBrowseState;
  searchEditing: boolean;
  linkFlow: LinkFlow | null;
  statusLine: string;
  busy: boolean;
  devicePicker: DevicePickerState;
};

export type AuthenticatedAppAction =
  | { type: "set-busy"; busy: boolean }
  | { type: "set-status-line"; statusLine: string }
  | { type: "replace-home-snapshot"; snapshot: HomeSnapshot }
  | { type: "patch-home-snapshot"; patch: Partial<HomeSnapshot> }
  | { type: "reset-progress-tick" }
  | { type: "advance-progress-tick"; amountMs: number }
  | { type: "set-page"; page: AppPage }
  | { type: "set-focus-region"; focusRegion: AppFocusRegion }
  | { type: "move-content-selection"; direction: "up" | "down" }
  | { type: "set-content-index"; contentIndex: number }
  | { type: "set-search-editing"; searchEditing: boolean }
  | { type: "set-search-query"; searchQuery: string }
  | { type: "search-started" }
  | { type: "search-completed"; results: SearchResults }
  | { type: "search-failed"; error: string }
  | { type: "replace-browse-state"; browseState: ShellBrowseState }
  | { type: "patch-browse-state"; patch: Partial<ShellBrowseState> }
  | { type: "open-liked-tracks" }
  | { type: "close-liked-tracks" }
  | { type: "open-playlist-detail"; detail: PlaylistDetail }
  | { type: "close-playlist-detail" }
  | { type: "open-device-picker" }
  | { type: "close-device-picker" }
  | { type: "set-device-picker-loading"; loading: boolean }
  | { type: "set-device-list"; devices: SpotifyDeviceSummary[] }
  | { type: "move-device-selection"; direction: "up" | "down" }
  | { type: "set-link-flow"; linkFlow: LinkFlow | null };

function getSections(page: AppPage, browseState: ShellBrowseState) {
  return page === "home"
    ? buildHomeSections(browseState)
    : page === "search"
      ? buildSearchSections(browseState)
      : page === "library"
        ? buildLibrarySections(browseState)
        : buildPlaylistsSections(browseState);
}

export function getPageItemCount(page: AppPage, browseState: ShellBrowseState): number {
  return flattenSections(getSections(page, browseState)).length;
}

function clampContentIndex(page: AppPage, browseState: ShellBrowseState, current: number): number {
  const count = getPageItemCount(page, browseState);
  if (count <= 0) {
    return 0;
  }

  return Math.min(Math.max(0, current), count - 1);
}

function withBrowseState(
  state: AuthenticatedAppState,
  browseState: ShellBrowseState
): AuthenticatedAppState {
  return {
    ...state,
    browseState,
    contentIndex: clampContentIndex(state.appPage, browseState, state.contentIndex)
  };
}

export function createInitialAuthenticatedAppState(initialStatusLine: string): AuthenticatedAppState {
  return {
    homeSnapshot: createPendingAuthenticatedHomeSnapshot(),
    progressTickMs: 0,
    appPage: "home",
    focusRegion: "content",
    contentIndex: 0,
    browseState: createInitialShellBrowseState(),
    searchEditing: false,
    linkFlow: null,
    statusLine: initialStatusLine,
    busy: false,
    devicePicker: {
      open: false,
      loading: false,
      devices: [],
      selectedIndex: 0
    }
  };
}

export function authenticatedAppReducer(
  state: AuthenticatedAppState,
  action: AuthenticatedAppAction
): AuthenticatedAppState {
  switch (action.type) {
    case "set-busy":
      return {
        ...state,
        busy: action.busy
      };
    case "set-status-line":
      return {
        ...state,
        statusLine: action.statusLine
      };
    case "replace-home-snapshot":
      return withBrowseState(
        {
          ...state,
          homeSnapshot: action.snapshot
        },
        {
          ...state.browseState,
          recentTracks: action.snapshot.recent
        }
      );
    case "patch-home-snapshot":
      return {
        ...state,
        homeSnapshot: {
          ...state.homeSnapshot,
          ...action.patch
        }
      };
    case "reset-progress-tick":
      return {
        ...state,
        progressTickMs: 0
      };
    case "advance-progress-tick":
      return {
        ...state,
        progressTickMs: Math.min(state.homeSnapshot.durationMs, state.progressTickMs + action.amountMs)
      };
    case "set-page":
      return {
        ...state,
        appPage: action.page,
        contentIndex: 0,
        searchEditing: false
      };
    case "set-focus-region":
      return {
        ...state,
        focusRegion: action.focusRegion
      };
    case "move-content-selection":
      return {
        ...state,
        contentIndex: moveSelection(
          state.contentIndex,
          action.direction,
          getPageItemCount(state.appPage, state.browseState)
        )
      };
    case "set-content-index":
      return {
        ...state,
        contentIndex: clampContentIndex(state.appPage, state.browseState, action.contentIndex)
      };
    case "set-search-editing":
      return {
        ...state,
        searchEditing: action.searchEditing
      };
    case "set-search-query":
      return withBrowseState(state, {
        ...state.browseState,
        searchQuery: action.searchQuery
      });
    case "search-started":
      return withBrowseState(state, {
        ...state.browseState,
        searchBusy: true,
        searchError: ""
      });
    case "search-completed":
      return withBrowseState(state, {
        ...state.browseState,
        searchBusy: false,
        searchResults: action.results,
        searchError: ""
      });
    case "search-failed":
      return withBrowseState(state, {
        ...state.browseState,
        searchBusy: false,
        searchError: action.error,
        searchResults: { tracks: [], playlists: [], albums: [], artists: [] }
      });
    case "replace-browse-state":
      return withBrowseState(state, action.browseState);
    case "patch-browse-state":
      return withBrowseState(state, {
        ...state.browseState,
        ...action.patch
      });
    case "open-liked-tracks":
      return withBrowseState(
        {
          ...state,
          appPage: "library",
          contentIndex: 0
        },
        {
          ...state.browseState,
          libraryView: "liked-tracks"
        }
      );
    case "close-liked-tracks":
      return withBrowseState(
        {
          ...state,
          appPage: "library",
          contentIndex: 0
        },
        {
          ...state.browseState,
          libraryView: "overview"
        }
      );
    case "open-playlist-detail":
      return withBrowseState(
        {
          ...state,
          appPage: "playlists",
          contentIndex: 0
        },
        {
          ...state.browseState,
          playlistDetail: action.detail
        }
      );
    case "close-playlist-detail":
      return withBrowseState(
        {
          ...state,
          appPage: "playlists",
          contentIndex: 0
        },
        {
          ...state.browseState,
          playlistDetail: null
        }
      );
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
          selectedIndex: clampDeviceSelection(
            state.devicePicker.selectedIndex,
            action.devices.length
          )
        }
      };
    case "move-device-selection":
      return {
        ...state,
        devicePicker: {
          ...state.devicePicker,
          selectedIndex: moveSelection(
            state.devicePicker.selectedIndex,
            action.direction,
            state.devicePicker.devices.length
          )
        }
      };
    case "set-link-flow":
      return {
        ...state,
        linkFlow: action.linkFlow
      };
    default:
      return state;
  }
}
