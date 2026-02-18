import type { AppEnv } from "../../config/env";

export type SpotifyStartAuthResponse = {
  authorizeUrl: string;
  state: string;
};

export type SpotifyCallbackResponse = {
  linked: boolean;
  userId: string;
};

export type SpotifyCurrentlyPlayingResponse = {
  isPlaying: boolean;
  trackName: string;
  artistName: string;
  albumName: string;
};

export type SpotifyService = {
  isConfigured: () => boolean;
  startAuthorization: (userId: string) => SpotifyStartAuthResponse;
  completeAuthorization: (userId: string, code: string, state: string) => Promise<SpotifyCallbackResponse>;
  getCurrentlyPlaying: (userId: string) => Promise<SpotifyCurrentlyPlayingResponse>;
};

export function createSpotifyService(env: AppEnv): SpotifyService {
  const isConfigured = () =>
    Boolean(env.SPOTIFY_CLIENT_ID && env.SPOTIFY_CLIENT_SECRET && env.SPOTIFY_REDIRECT_URI);

  return {
    isConfigured,
    startAuthorization(userId: string) {
      if (!isConfigured()) {
        throw new Response("Spotify is not configured", { status: 503 });
      }

      const state = `${userId}.${Date.now()}`;
      const params = new URLSearchParams({
        client_id: env.SPOTIFY_CLIENT_ID!,
        response_type: "code",
        redirect_uri: env.SPOTIFY_REDIRECT_URI!,
        scope: "user-read-email user-read-playback-state",
        state
      });

      return {
        authorizeUrl: `https://accounts.spotify.com/authorize?${params.toString()}`,
        state
      };
    },
    async completeAuthorization(userId: string, code: string, state: string) {
      if (!isConfigured()) {
        throw new Response("Spotify is not configured", { status: 503 });
      }

      if (!code || !state) {
        throw new Response("Missing code or state", { status: 400 });
      }

      return {
        linked: true,
        userId
      };
    },
    async getCurrentlyPlaying() {
      if (!isConfigured()) {
        throw new Response("Spotify is not configured", { status: 503 });
      }

      return {
        isPlaying: true,
        trackName: "Dreams",
        artistName: "Fleetwood Mac",
        albumName: "Rumours"
      };
    }
  };
}
