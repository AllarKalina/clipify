export type SpotifyPlaybackState = "playing" | "paused" | "idle";
export type SpotifyDeviceStatus = "active" | "available" | "restricted" | "none";
export type SpotifyRepeatMode = "off" | "track" | "context";

export type SpotifyStartAuthResponse = {
  authorizeUrl: string;
  state: string;
};

export type SpotifyCallbackResponse = {
  linked: boolean;
  userId: string;
};

export type SpotifyAuthStatusResponse = {
  linked: boolean;
  relinkRequired: boolean;
};

export type SpotifyCurrentlyPlayingResponse = {
  playbackState: SpotifyPlaybackState;
  isPlaying: boolean;
  trackName: string;
  artistName: string;
  albumName: string;
  albumImageUrl: string;
  deviceId: string;
  deviceName: string;
  deviceType: string;
  deviceStatus: SpotifyDeviceStatus;
  supportsVolume: boolean;
  volumePercent: number;
  shuffleEnabled: boolean;
  repeatMode: SpotifyRepeatMode;
  progressMs: number;
  durationMs: number;
};

export type SpotifyQueueItem = {
  trackName: string;
  artistName: string;
  albumName: string;
  type: "track" | "episode" | "unknown";
};

export type SpotifyQueueResponse = {
  items: SpotifyQueueItem[];
};

export type SpotifyDeviceSummary = {
  id: string;
  name: string;
  type: string;
  isActive: boolean;
  isRestricted: boolean;
  supportsVolume: boolean;
  volumePercent: number;
};

export type SpotifyDevicesResponse = {
  items: SpotifyDeviceSummary[];
};

export type SpotifyTrackSummary = {
  id: string;
  trackName: string;
  artistName: string;
  albumName: string;
  uri: string;
  durationMs: number;
};

export type SpotifyPlaylistSummary = {
  id: string;
  name: string;
  description: string;
  imageUrl: string;
  ownerName: string;
  isPinned?: boolean;
  trackCount: number;
  uri: string;
};

export type SpotifyAlbumSummary = {
  id: string;
  name: string;
  artistName: string;
  imageUrl: string;
  uri: string;
};

export type SpotifyArtistSummary = {
  id: string;
  name: string;
  imageUrl: string;
  uri: string;
};

export type SpotifyPlaylistsResponse = {
  items: SpotifyPlaylistSummary[];
};

export type SpotifySavedTracksResponse = {
  items: SpotifyTrackSummary[];
};

export type SpotifyPlaylistDetailResponse = {
  id: string;
  name: string;
  description: string;
  imageUrl: string;
  ownerName: string;
  isPinned?: boolean;
  trackCount: number;
  uri: string;
  tracks: SpotifyTrackSummary[];
};

export type SpotifyFeaturedPlaylistsResponse = {
  items: SpotifyPlaylistSummary[];
};

export type SpotifySearchResponse = {
  tracks: SpotifyTrackSummary[];
  playlists: SpotifyPlaylistSummary[];
  albums: SpotifyAlbumSummary[];
  artists: SpotifyArtistSummary[];
};

export type SpotifyRecentlyPlayedItem = {
  id: string;
  trackName: string;
  artistName: string;
  albumName: string;
  uri: string;
  durationMs: number;
  playedAt: string;
};

export type SpotifyRecentlyPlayedResponse = {
  items: SpotifyRecentlyPlayedItem[];
};

export type SpotifyPlayerAction = "play" | "pause" | "next" | "previous";
export type SpotifyPlayerModeAction =
  | SpotifyPlayerAction
  | "shuffle"
  | "repeat"
  | "volume"
  | "transfer"
  | "play-track"
  | "play-context";

export type SpotifyPlayerActionResponse = {
  ok: true;
  action: SpotifyPlayerModeAction;
};

export type SpotifyProfileResponse = {
  id: string;
  displayName: string;
  email: string;
  profileUrl: string;
  imageUrl: string;
};
