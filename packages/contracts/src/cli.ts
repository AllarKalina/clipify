import type {
  SpotifyAuthStatusResponse,
  SpotifyCurrentlyPlayingResponse,
  SpotifyDeviceStatus,
  SpotifyDevicesResponse,
  SpotifyFeaturedPlaylistsResponse,
  SpotifyPlayerActionResponse,
  SpotifyPlaylistsResponse,
  SpotifyProfileResponse,
  SpotifyQueueResponse,
  SpotifyRecentlyPlayedResponse,
  SpotifyRepeatMode,
  SpotifySavedTracksResponse,
  SpotifySearchResponse,
  SpotifyStartAuthResponse
} from "./spotify";

export type CliQueueStatus = "ready" | "no-device" | "relink-required" | "unavailable";
export type CliSpotifyStatus = "linked" | "not-linked" | "relink-required";
export type CliErrorCode =
  | "UNAUTHORIZED"
  | "INVALID_INPUT"
  | "RELINK_REQUIRED"
  | "PREMIUM_REQUIRED"
  | "NO_ACTIVE_DEVICE"
  | "DEVICE_RESTRICTED"
  | "NOT_FOUND"
  | "FORBIDDEN"
  | "CONFLICT"
  | "UPSTREAM_FAILURE"
  | "SERVICE_UNAVAILABLE"
  | "RATE_LIMITED"
  | "BAD_REQUEST"
  | "INTERNAL_ERROR";
export type CliAuthStartResponse = SpotifyStartAuthResponse;
export type CliAuthStatusResponse = SpotifyAuthStatusResponse;

export type CliErrorResponse = {
  error: {
    code: CliErrorCode;
    message: string;
    hint?: string;
  };
};

export type CliBootstrapHome = {
  spotify: CliSpotifyStatus;
  userName: string;
  userEmail: string;
  spotifyDisplayName: string;
  deviceId: string;
  deviceName: string;
  deviceType: string;
  deviceStatus: SpotifyDeviceStatus;
  supportsVolume: boolean;
  volumePercent: number;
  playbackState: SpotifyCurrentlyPlayingResponse["playbackState"];
  shuffleEnabled: boolean;
  repeatMode: SpotifyRepeatMode;
  trackName: string;
  artistName: string;
  albumName: string;
  contextUri: string;
  progressMs: number;
  durationMs: number;
  queueStatus: CliQueueStatus;
  queue: SpotifyQueueResponse["items"];
  recentUnavailable: boolean;
  recent: SpotifyRecentlyPlayedResponse["items"];
  linked: boolean;
  relinkRequired: boolean;
  profile: SpotifyProfileResponse | null;
};

export type CliBootstrapBrowse = {
  featuredPlaylists: SpotifyFeaturedPlaylistsResponse["items"];
  playlists: SpotifyPlaylistsResponse["items"];
  likedTracks: SpotifySavedTracksResponse["items"];
};

export type CliBootstrapResponse = {
  home: CliBootstrapHome;
  browse: CliBootstrapBrowse;
  warning: string;
};

export type CliPlayerSnapshotResponse = {
  home: CliBootstrapHome;
  warning: string;
};

export type CliLibraryViewResponse = {
  section: {
    id: string;
    title: string;
    items: Array<{
      id: string;
      title: string;
      subtitle: string;
      meta?: string;
      addedAt?: string;
      action: { type: "play-track"; uri: string };
    }>;
  } | null;
};

export type CliSearchResponse = SpotifySearchResponse;
export type CliDevicesResponse = SpotifyDevicesResponse;

export type CliPlayerActionRequest =
  | { action: "play" }
  | { action: "pause" }
  | { action: "next" }
  | { action: "previous" }
  | { action: "shuffle"; enabled: boolean }
  | { action: "repeat"; mode: SpotifyRepeatMode }
  | { action: "volume"; volumePercent: number }
  | { action: "transfer"; deviceId: string }
  | { action: "play-track"; uri: string }
  | { action: "play-context"; contextUri: string };

export type CliPlayerActionResponse = SpotifyPlayerActionResponse;
