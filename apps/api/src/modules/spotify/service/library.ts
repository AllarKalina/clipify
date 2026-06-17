import type {
  SpotifyFeaturedPlaylistsResponse,
  SpotifyPlaylistDetailResponse,
  SpotifyPlaylistsResponse,
  SpotifySavedTracksResponse
} from "../contracts";
import {
  buildPlaylistItemsUrl,
  summarizePlaylist,
  summarizePlaylistTracks,
  summarizeTrack,
  type SpotifyPlaylistItemsPagePayload,
  type SpotifyServiceContext
} from "./shared";

export type SpotifyLibraryService = {
  getFeaturedPlaylists: (userId: string) => Promise<SpotifyFeaturedPlaylistsResponse>;
  getPlaylists: (userId: string) => Promise<SpotifyPlaylistsResponse>;
  getSavedTracks: (userId: string) => Promise<SpotifySavedTracksResponse>;
  getPlaylist: (userId: string, playlistId: string) => Promise<SpotifyPlaylistDetailResponse>;
};

export function createSpotifyLibraryService(context: SpotifyServiceContext): SpotifyLibraryService {
  return {
    async getFeaturedPlaylists(userId) {
      context.requireConfigured();

      const featuredUrl = new URL("https://api.spotify.com/v1/browse/featured-playlists");
      featuredUrl.searchParams.set("limit", "8");
      featuredUrl.searchParams.set(
        "fields",
        "playlists(items(id,name,description,images,owner(display_name),items(total),uri))"
      );

      const { response } = await context.fetchSpotifyWithRetry(userId, featuredUrl.toString());

      if (!response.ok) {
        const text = await response.text();
        throw new Response(`Spotify featured-playlists request failed (${response.status}): ${text || "empty response"}`, {
          status: response.status
        });
      }

      const payload = (await response.json()) as {
        playlists?: {
          items?: Array<Parameters<typeof summarizePlaylist>[0]>;
        };
      };

      return {
        items: (payload.playlists?.items ?? []).map((item) => summarizePlaylist(item))
      };
    },

    async getPlaylists(userId) {
      context.requireConfigured();

      const playlistsUrl = new URL("https://api.spotify.com/v1/me/playlists");
      playlistsUrl.searchParams.set("limit", "20");
      playlistsUrl.searchParams.set(
        "fields",
        "items(id,name,description,images,owner(display_name),items(total),uri)"
      );

      const { response } = await context.fetchSpotifyWithRetry(userId, playlistsUrl.toString());

      if (!response.ok) {
        const text = await response.text();
        throw new Response(`Spotify playlists request failed (${response.status}): ${text || "empty response"}`, {
          status: response.status
        });
      }

      const payload = (await response.json()) as {
        items?: Array<{
          id?: string;
          name?: string;
          description?: string | null;
          images?: Array<{ url?: string }>;
          owner?: { display_name?: string | null };
          items?: { total?: number };
          uri?: string;
        }>;
      };

      return {
        items: (payload.items ?? []).map((item) => summarizePlaylist(item))
      };
    },

    async getSavedTracks(userId) {
      context.requireConfigured();

      const { response } = await context.fetchSpotifyWithRetry(userId, "https://api.spotify.com/v1/me/tracks?limit=20");

      if (!response.ok) {
        const text = await response.text();
        throw new Response(`Spotify saved-tracks request failed (${response.status}): ${text || "empty response"}`, {
          status: response.status
        });
      }

      const payload = (await response.json()) as {
        items?: Array<{
          added_at?: string | null;
          track?: {
            id?: string;
            name?: string;
            artists?: Array<{ name?: string }>;
            album?: { name?: string };
            uri?: string;
            duration_ms?: number;
          };
        }>;
      };

      return {
        items: (payload.items ?? []).map((item) => summarizeTrack({ ...(item.track ?? {}), added_at: item.added_at ?? undefined }))
      };
    },

    async getPlaylist(userId, playlistId) {
      context.requireConfigured();

      const playlistUrl = new URL(`https://api.spotify.com/v1/playlists/${playlistId}`);
      playlistUrl.searchParams.set(
        "fields",
        "id,name,description,images,owner(display_name),uri,items(total)"
      );

      const { response } = await context.fetchSpotifyWithRetry(userId, playlistUrl.toString());

      if (!response.ok) {
        const text = await response.text();
        throw new Response(`Spotify playlist request failed (${response.status}): ${text || "empty response"}`, {
          status: response.status
        });
      }

      const payload = (await response.json()) as {
        id?: string;
        name?: string;
        description?: string | null;
        images?: Array<{ url?: string }>;
        owner?: { display_name?: string | null };
        items?: {
          total?: number;
        };
        uri?: string;
      };

      const tracks: SpotifyPlaylistDetailResponse["tracks"] = [];
      let nextPageUrl: string | null = buildPlaylistItemsUrl(playlistId);

      while (nextPageUrl) {
        const { response: itemsResponse } = await context.fetchSpotifyWithRetry(userId, nextPageUrl);

        if (!itemsResponse.ok) {
          const text = await itemsResponse.text();
          throw new Response(`Spotify playlist items request failed (${itemsResponse.status}): ${text || "empty response"}`, {
            status: itemsResponse.status
          });
        }

        const itemsPayload = (await itemsResponse.json()) as SpotifyPlaylistItemsPagePayload;
        tracks.push(...summarizePlaylistTracks(itemsPayload.items));
        nextPageUrl = itemsPayload.next ?? null;
      }

      return {
        ...summarizePlaylist(payload),
        tracks
      };
    }
  };
}
