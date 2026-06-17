import type { SpotifyDeviceSummary } from "@clipify/api-client";
import {
  buildHomeSections,
  buildLikedTracksSections,
  buildPlaylistDetailSections,
  buildSearchSections,
  createInitialShellBrowseState,
  buildLibrarySidebarItems,
  flattenSections,
  moveSelection,
  type AppFocusRegion,
  type MainView,
  type PlaylistDetail,
  type SearchResults,
  type ShellBrowseState
} from "./app-shell-state";
import { clampDeviceSelection } from "./device-picker-state";
import { createPendingAuthenticatedHomeSnapshot, type HomeSnapshot } from "./home-state";

export type LinkFlow = {
  authorizeUrl: string;
};

export type DevicePickerState = {
  open: boolean;
  loading: boolean;
  devices: SpotifyDeviceSummary[];
  selectedIndex: number;
};

export type PlaylistReturnTarget = {
  mainView: Exclude<MainView, "playlist-detail">;
  focusRegion: AppFocusRegion;
  sidebarIndex: number;
  contentIndex: number;
};

export type AuthenticatedAppState = {
  homeSnapshot: HomeSnapshot;
  progressTickMs: number;
  mainView: MainView;
  focusRegion: AppFocusRegion;
  sidebarIndex: number;
  contentIndex: number;
  playlistReturnTarget: PlaylistReturnTarget | null;
  browseState: ShellBrowseState;
  searchEditing: boolean;
  controlPrefixActive: boolean;
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
  | { type: "set-main-view"; mainView: MainView }
  | { type: "set-focus-region"; focusRegion: AppFocusRegion }
  | { type: "move-sidebar-selection"; direction: "up" | "down" }
  | { type: "set-sidebar-index"; sidebarIndex: number }
  | { type: "move-content-selection"; direction: "up" | "down" }
  | { type: "set-content-index"; contentIndex: number }
  | { type: "set-search-editing"; searchEditing: boolean }
  | { type: "set-control-prefix-active"; controlPrefixActive: boolean }
  | { type: "set-search-query"; searchQuery: string }
  | { type: "reset-search" }
  | { type: "submit-search-query" }
  | { type: "search-started" }
  | { type: "search-completed"; results: SearchResults }
  | { type: "search-failed"; error: string }
  | { type: "replace-browse-state"; browseState: ShellBrowseState }
  | { type: "patch-browse-state"; patch: Partial<ShellBrowseState> }
  | { type: "open-liked-tracks" }
  | { type: "open-playlist-detail"; detail: PlaylistDetail }
  | { type: "close-playlist-detail" }
  | { type: "open-device-picker" }
  | { type: "close-device-picker" }
  | { type: "set-device-picker-loading"; loading: boolean }
  | { type: "set-device-list"; devices: SpotifyDeviceSummary[] }
  | { type: "move-device-selection"; direction: "up" | "down" }
  | { type: "set-link-flow"; linkFlow: LinkFlow | null };

function buildMainSections(state: AuthenticatedAppState) {
  return state.mainView === "home"
    ? buildHomeSections(state.homeSnapshot, state.browseState)
    : state.mainView === "search-results"
      ? buildSearchSections(state.browseState)
      : state.mainView === "liked-tracks"
        ? buildLikedTracksSections(state.browseState)
        : buildPlaylistDetailSections(state.browseState);
}

function getSidebarItemCount(state: AuthenticatedAppState): number {
  return buildLibrarySidebarItems(state.browseState, state.browseState.pinnedPlaylistNames).length;
}

export function getMainItemCount(state: AuthenticatedAppState): number {
  return 1 + flattenSections(buildMainSections(state)).length;
}

function clampSelection(current: number, count: number): number {
  if (count <= 0) {
    return 0;
  }

  return Math.min(Math.max(0, current), count - 1);
}

function withBrowseState(state: AuthenticatedAppState, browseState: ShellBrowseState): AuthenticatedAppState {
  const nextState = {
    ...state,
    browseState
  };

  return {
    ...nextState,
    sidebarIndex: clampSelection(state.sidebarIndex, getSidebarItemCount(nextState)),
    contentIndex: clampSelection(state.contentIndex, getMainItemCount(nextState))
  };
}

function getPlaylistReturnTarget(state: AuthenticatedAppState): PlaylistReturnTarget {
  if (state.mainView === "playlist-detail") {
    return {
      mainView: state.playlistReturnTarget?.mainView ?? "home",
      focusRegion: state.focusRegion,
      sidebarIndex: state.sidebarIndex,
      contentIndex: state.playlistReturnTarget?.contentIndex ?? 0
    };
  }

  return {
    mainView: state.mainView,
    focusRegion: state.focusRegion,
    sidebarIndex: state.sidebarIndex,
    contentIndex: state.contentIndex
  };
}

export function createInitialAuthenticatedAppState(
  initialStatusLine: string,
  pinnedPlaylistNames: string[] = []
): AuthenticatedAppState {
  return {
    homeSnapshot: createPendingAuthenticatedHomeSnapshot(),
    progressTickMs: 0,
    mainView: "home",
    focusRegion: "content",
    sidebarIndex: 0,
    contentIndex: 0,
    playlistReturnTarget: null,
    browseState: createInitialShellBrowseState(pinnedPlaylistNames),
    searchEditing: false,
    controlPrefixActive: false,
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

export function authenticatedAppReducer(state: AuthenticatedAppState, action: AuthenticatedAppAction): AuthenticatedAppState {
  switch (action.type) {
    case "set-busy":
      return { ...state, busy: action.busy };
    case "set-status-line":
      return { ...state, statusLine: action.statusLine };
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
      return { ...state, progressTickMs: 0 };
    case "advance-progress-tick":
      return {
        ...state,
        progressTickMs: Math.min(state.homeSnapshot.durationMs, state.progressTickMs + action.amountMs)
      };
    case "set-main-view":
      return {
        ...state,
        mainView: action.mainView,
        contentIndex: 0,
        playlistReturnTarget: action.mainView === "playlist-detail" ? state.playlistReturnTarget : null,
        searchEditing: false
      };
    case "set-focus-region":
      return { ...state, focusRegion: action.focusRegion };
    case "move-sidebar-selection":
      return {
        ...state,
        sidebarIndex: moveSelection(state.sidebarIndex, action.direction, getSidebarItemCount(state))
      };
    case "set-sidebar-index":
      return {
        ...state,
        sidebarIndex: clampSelection(action.sidebarIndex, getSidebarItemCount(state))
      };
    case "move-content-selection":
      return {
        ...state,
        contentIndex: moveSelection(state.contentIndex, action.direction, getMainItemCount(state))
      };
    case "set-content-index":
      return {
        ...state,
        contentIndex: clampSelection(action.contentIndex, getMainItemCount(state))
      };
    case "set-search-editing":
      return { ...state, searchEditing: action.searchEditing };
    case "set-control-prefix-active":
      return { ...state, controlPrefixActive: action.controlPrefixActive };
    case "set-search-query": {
      return withBrowseState(
        state,
        {
          ...state.browseState,
          searchQuery: action.searchQuery
        }
      );
    }
    case "reset-search":
      return withBrowseState(state, {
        ...state.browseState,
        searchQuery: "",
        submittedSearchQuery: "",
        searchRequestId: 0,
        searchBusy: false,
        searchError: "",
        searchResults: { tracks: [], playlists: [], albums: [], artists: [] }
      });
    case "submit-search-query": {
      const submittedSearchQuery = state.browseState.searchQuery.trim();
      if (!submittedSearchQuery) {
        return withBrowseState(
          {
            ...state,
            mainView: state.mainView === "search-results" ? "home" : state.mainView
          },
          {
            ...state.browseState,
            submittedSearchQuery: "",
            searchBusy: false,
            searchError: ""
          }
        );
      }

      return withBrowseState(
        {
          ...state,
          mainView: "search-results"
        },
        {
          ...state.browseState,
          submittedSearchQuery,
          searchRequestId: state.browseState.searchRequestId + 1,
          searchBusy: true,
          searchError: ""
        }
      );
    }
    case "search-started":
      return withBrowseState(
        {
          ...state,
          mainView: state.browseState.searchQuery.trim() ? "search-results" : state.mainView
        },
        {
          ...state.browseState,
          searchBusy: true,
          searchError: ""
        }
      );
    case "search-completed":
      return withBrowseState(
        {
          ...state,
          mainView: "search-results"
        },
        {
          ...state.browseState,
          searchBusy: false,
          searchResults: action.results,
          searchError: ""
        }
      );
    case "search-failed":
      return withBrowseState(
        {
          ...state,
          mainView: "search-results"
        },
        {
          ...state.browseState,
          searchBusy: false,
          searchError: action.error,
          searchResults: { tracks: [], playlists: [], albums: [], artists: [] }
        }
      );
    case "replace-browse-state":
      return withBrowseState(state, action.browseState);
    case "patch-browse-state":
      return withBrowseState(state, {
        ...state.browseState,
        ...action.patch
      });
    case "open-liked-tracks":
      return {
        ...withBrowseState(state, state.browseState),
        mainView: "liked-tracks",
        focusRegion: "content",
        contentIndex: 0
      };
    case "open-playlist-detail":
      return {
        ...withBrowseState(
          state,
          {
            ...state.browseState,
            playlistDetail: action.detail
          }
        ),
        mainView: "playlist-detail",
        focusRegion: "content",
        contentIndex: action.detail.tracks.length > 0 ? 1 : 0,
        playlistReturnTarget: getPlaylistReturnTarget(state)
      };
    case "close-playlist-detail": {
      const target =
        state.playlistReturnTarget ??
        ({
          mainView: "home",
          focusRegion: "content",
          sidebarIndex: state.sidebarIndex,
          contentIndex: 0
        } satisfies PlaylistReturnTarget);

      return withBrowseState(
        {
          ...state,
          mainView: target.mainView,
          focusRegion: target.focusRegion,
          sidebarIndex: target.sidebarIndex,
          contentIndex: target.contentIndex,
          playlistReturnTarget: null,
          searchEditing: false
        },
        state.browseState
      );
    }
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
          selectedIndex: moveSelection(
            state.devicePicker.selectedIndex,
            action.direction,
            state.devicePicker.devices.length
          )
        }
      };
    case "set-link-flow":
      return { ...state, linkFlow: action.linkFlow };
    default:
      return state;
  }
}
