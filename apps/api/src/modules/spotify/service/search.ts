import type { SpotifySearchResponse } from "../contracts";
import { summarizeAlbum, summarizeArtist, summarizePlaylist, summarizeTrack, type SpotifyServiceContext } from "./shared";

export type SpotifySearchService = {
  search: (userId: string, query: string) => Promise<SpotifySearchResponse>;
};

export function createSpotifySearchService(context: SpotifyServiceContext): SpotifySearchService {
  return {
    async search(userId, query) {
      context.requireConfigured();

      const url = new URL("https://api.spotify.com/v1/search");
      url.searchParams.set("q", query);
      url.searchParams.set("type", "track,playlist,album,artist");
      url.searchParams.set("limit", "5");

      const { response } = await context.fetchSpotifyWithRetry(userId, url.toString());

      if (!response.ok) {
        const text = await response.text();
        throw new Response(`Spotify search request failed (${response.status}): ${text || "empty response"}`, {
          status: response.status
        });
      }

      const payload = (await response.json()) as {
        tracks?: { items?: Array<Parameters<typeof summarizeTrack>[0]> };
        playlists?: { items?: Array<Parameters<typeof summarizePlaylist>[0]> };
        albums?: { items?: Array<Parameters<typeof summarizeAlbum>[0]> };
        artists?: { items?: Array<Parameters<typeof summarizeArtist>[0]> };
      };

      return {
        tracks: (payload.tracks?.items ?? []).map((item) => summarizeTrack(item)),
        playlists: (payload.playlists?.items ?? []).map((item) => summarizePlaylist(item)),
        albums: (payload.albums?.items ?? []).map((item) => summarizeAlbum(item)),
        artists: (payload.artists?.items ?? []).map((item) => summarizeArtist(item))
      };
    }
  };
}
