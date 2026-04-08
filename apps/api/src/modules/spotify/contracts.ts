export type SpotifyPlaybackState = "playing" | "paused" | "idle";

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
};

export type SpotifyCurrentlyPlayingResponse = {
  playbackState: SpotifyPlaybackState;
  isPlaying: boolean;
  trackName: string;
  artistName: string;
  albumName: string;
  albumImageUrl: string;
  deviceName: string;
  deviceType: string;
  progressMs: number;
  durationMs: number;
};

export type SpotifyRecentlyPlayedItem = {
  trackName: string;
  artistName: string;
  albumName: string;
  playedAt: string;
};

export type SpotifyRecentlyPlayedResponse = {
  items: SpotifyRecentlyPlayedItem[];
};

export type SpotifyProfileResponse = {
  id: string;
  displayName: string;
  email: string;
  profileUrl: string;
  imageUrl: string;
};
