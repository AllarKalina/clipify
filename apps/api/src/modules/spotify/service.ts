import type {
  SpotifyAuthStatusResponse,
  SpotifyCallbackResponse,
  SpotifyCurrentlyPlayingResponse,
  SpotifyDevicesResponse,
  SpotifyFeaturedPlaylistsResponse,
  SpotifyPlayerActionResponse,
  SpotifyPlaylistDetailResponse,
  SpotifyPlaylistsResponse,
  SpotifyProfileResponse,
  SpotifyQueueResponse,
  SpotifyRecentlyPlayedResponse,
  SpotifyRepeatMode,
  SpotifySavedTracksResponse,
  SpotifySearchResponse,
  SpotifyStartAuthResponse
} from "./contracts";
import { createSpotifyAuthLinkingService } from "./service/auth-linking";
import { createSpotifyServiceContext } from "./service/context";
import { createSpotifyLibraryService } from "./service/library";
import { createSpotifyPlayerService } from "./service/player";
import { createSpotifyProfileService } from "./service/profile";
import { createSpotifySearchService } from "./service/search";
import type { SpotifyServiceDeps } from "./service/shared";
import type { AppEnv } from "../../config/env";

export type SpotifyService = {
  isConfigured: () => boolean;
  startAuthorization: (userId: string) => Promise<SpotifyStartAuthResponse>;
  completeAuthorization: (userId: string, code: string, state: string) => Promise<SpotifyCallbackResponse>;
  completeAuthorizationFromCallback: (code: string, state: string) => Promise<SpotifyCallbackResponse>;
  getAuthorizationStatus: (userId: string) => Promise<SpotifyAuthStatusResponse>;
  getCurrentlyPlaying: (userId: string) => Promise<SpotifyCurrentlyPlayingResponse>;
  getDevices: (userId: string) => Promise<SpotifyDevicesResponse>;
  getQueue: (userId: string) => Promise<SpotifyQueueResponse>;
  getRecentlyPlayed: (userId: string) => Promise<SpotifyRecentlyPlayedResponse>;
  getFeaturedPlaylists: (userId: string) => Promise<SpotifyFeaturedPlaylistsResponse>;
  getPlaylists: (userId: string) => Promise<SpotifyPlaylistsResponse>;
  getSavedTracks: (userId: string) => Promise<SpotifySavedTracksResponse>;
  getPlaylist: (userId: string, playlistId: string) => Promise<SpotifyPlaylistDetailResponse>;
  search: (userId: string, query: string) => Promise<SpotifySearchResponse>;
  play: (userId: string) => Promise<SpotifyPlayerActionResponse>;
  pause: (userId: string) => Promise<SpotifyPlayerActionResponse>;
  next: (userId: string) => Promise<SpotifyPlayerActionResponse>;
  previous: (userId: string) => Promise<SpotifyPlayerActionResponse>;
  playTrack: (userId: string, uri: string) => Promise<SpotifyPlayerActionResponse>;
  playContext: (userId: string, contextUri: string) => Promise<SpotifyPlayerActionResponse>;
  transferPlayback: (userId: string, deviceId: string) => Promise<SpotifyPlayerActionResponse>;
  setShuffle: (userId: string, enabled: boolean) => Promise<SpotifyPlayerActionResponse>;
  setRepeatMode: (userId: string, mode: SpotifyRepeatMode) => Promise<SpotifyPlayerActionResponse>;
  setVolume: (userId: string, volumePercent: number) => Promise<SpotifyPlayerActionResponse>;
  getProfile: (userId: string) => Promise<SpotifyProfileResponse>;
};

export function createSpotifyService(env: AppEnv, deps: SpotifyServiceDeps): SpotifyService {
  const context = createSpotifyServiceContext(env, deps);
  const auth = createSpotifyAuthLinkingService(context);
  const player = createSpotifyPlayerService(context);
  const library = createSpotifyLibraryService(context);
  const search = createSpotifySearchService(context);
  const profile = createSpotifyProfileService(context);

  return {
    isConfigured: context.isConfigured,
    ...auth,
    ...player,
    ...library,
    ...search,
    ...profile
  };
}
