import { describe, expect, test } from "bun:test";
import { createSpotifyService } from "../src/modules/spotify/service";
import { baseEnv, createLinkedSpotifyService, createMemoryStore, grantedScope } from "./spotify.service.test-support";

describe("spotify service library", () => {
  test("reads playlist detail tracks from the current items payload", async () => {
    const store = createMemoryStore();
    await createLinkedSpotifyService({
      store,
      fetchImpl: async (url) => {
        if (String(url).includes("/api/token")) {
          return Response.json({
            access_token: "access-1",
            refresh_token: "refresh-1",
            token_type: "Bearer",
            scope: grantedScope,
            expires_in: 3600
          });
        }

        return Response.json({ id: "spotify-user-1" });
      }
    });

    const playlistService = createSpotifyService(baseEnv(), {
      store,
      fetchImpl: async (url) => {
        if (String(url).includes("/playlists/playlist-1/items")) {
          return Response.json({
            items: [
              {
                item: {
                  id: "track-1",
                  name: "Dreams",
                  artists: [{ name: "Fleetwood Mac" }],
                  album: { name: "Rumours" },
                  uri: "spotify:track:1",
                  duration_ms: 257000,
                  type: "track"
                }
              },
              {
                item: {
                  id: "episode-1",
                  name: "Podcast",
                  artists: [{ name: "Host" }],
                  album: { name: "Show" },
                  uri: "spotify:episode:1",
                  duration_ms: 1800000,
                  type: "episode"
                }
              },
              {
                item: null
              }
            ],
            next: null
          });
        }

        if (String(url).includes("/playlists/playlist-1")) {
          return Response.json({
            id: "playlist-1",
            name: "Roadtrip",
            description: "",
            images: [],
            owner: { display_name: "Allar" },
            tracks: { total: 3 },
            uri: "spotify:playlist:1"
          });
        }

        return Response.json({});
      }
    });

    await expect(playlistService.getPlaylist("user-1", "playlist-1")).resolves.toEqual({
      id: "playlist-1",
      name: "Roadtrip",
      description: "",
      imageUrl: "",
      ownerName: "Allar",
      isPinned: undefined,
      trackCount: 3,
      uri: "spotify:playlist:1",
      tracks: [
        {
          id: "track-1",
          trackName: "Dreams",
          artistName: "Fleetwood Mac",
          albumName: "Rumours",
          uri: "spotify:track:1",
          durationMs: 257000
        }
      ]
    });
  });

  test("keeps supporting legacy playlist track payloads", async () => {
    const store = createMemoryStore();
    await createLinkedSpotifyService({
      store,
      fetchImpl: async (url) => {
        if (String(url).includes("/api/token")) {
          return Response.json({
            access_token: "access-1",
            refresh_token: "refresh-1",
            token_type: "Bearer",
            scope: grantedScope,
            expires_in: 3600
          });
        }

        return Response.json({ id: "spotify-user-1" });
      }
    });

    const service = createSpotifyService(baseEnv(), {
      store,
      fetchImpl: async (url) => {
        if (String(url).includes("/playlists/playlist-1/items")) {
          return Response.json({
            items: [
              {
                track: {
                  id: "track-1",
                  name: "Dreams",
                  artists: [{ name: "Fleetwood Mac" }],
                  album: { name: "Rumours" },
                  uri: "spotify:track:1",
                  duration_ms: 257000,
                  type: "track"
                }
              }
            ],
            next: null
          });
        }

        return Response.json({
          id: "playlist-1",
          name: "Roadtrip",
          description: "",
          images: [],
          owner: { display_name: "Allar" },
          tracks: {
            total: 1
          },
          uri: "spotify:playlist:1"
        });
      }
    });

    await expect(service.getPlaylist("user-1", "playlist-1")).resolves.toEqual(
      expect.objectContaining({
        tracks: [
          {
            id: "track-1",
            trackName: "Dreams",
            artistName: "Fleetwood Mac",
            albumName: "Rumours",
            uri: "spotify:track:1",
            durationMs: 257000
          }
        ]
      })
    );
  });

  test("paginates playlist item responses until all tracks are loaded", async () => {
    const store = createMemoryStore();
    await createLinkedSpotifyService({
      store,
      fetchImpl: async (url) => {
        if (String(url).includes("/api/token")) {
          return Response.json({
            access_token: "access-1",
            refresh_token: "refresh-1",
            token_type: "Bearer",
            scope: grantedScope,
            expires_in: 3600
          });
        }

        return Response.json({ id: "spotify-user-1" });
      }
    });

    const service = createSpotifyService(baseEnv(), {
      store,
      fetchImpl: async (url) => {
        const value = String(url);

        if (value.includes("/playlists/playlist-1/items") && value.includes("offset=50")) {
          return Response.json({
            items: [
              {
                item: {
                  id: "track-2",
                  name: "Go Your Own Way",
                  artists: [{ name: "Fleetwood Mac" }],
                  album: { name: "Rumours" },
                  uri: "spotify:track:2",
                  duration_ms: 223000,
                  type: "track"
                }
              }
            ],
            next: null
          });
        }

        if (value.includes("/playlists/playlist-1/items")) {
          return Response.json({
            items: [
              {
                item: {
                  id: "track-1",
                  name: "Dreams",
                  artists: [{ name: "Fleetwood Mac" }],
                  album: { name: "Rumours" },
                  uri: "spotify:track:1",
                  duration_ms: 257000,
                  type: "track"
                }
              }
            ],
            next: "https://api.spotify.com/v1/playlists/playlist-1/items?offset=50&limit=50"
          });
        }

        return Response.json({
          id: "playlist-1",
          name: "Roadtrip",
          description: "",
          images: [],
          owner: { display_name: "Allar" },
          tracks: { total: 2 },
          uri: "spotify:playlist:1"
        });
      }
    });

    await expect(service.getPlaylist("user-1", "playlist-1")).resolves.toEqual(
      expect.objectContaining({
        trackCount: 2,
        tracks: [
          expect.objectContaining({ trackName: "Dreams" }),
          expect.objectContaining({ trackName: "Go Your Own Way" })
        ]
      })
    );
  });

  test("prefers items.total when summarizing playlist counts", async () => {
    const store = createMemoryStore();
    await createLinkedSpotifyService({
      store,
      fetchImpl: async (url) => {
        if (String(url).includes("/api/token")) {
          return Response.json({
            access_token: "access-1",
            refresh_token: "refresh-1",
            token_type: "Bearer",
            scope: grantedScope,
            expires_in: 3600
          });
        }

        return Response.json({ id: "spotify-user-1" });
      }
    });

    const service = createSpotifyService(baseEnv(), {
      store,
      fetchImpl: async (url) => {
        if (String(url).includes("/playlists/playlist-1/items")) {
          return Response.json({ items: [], next: null });
        }

        return Response.json({
          id: "playlist-1",
          name: "Roadtrip",
          description: "",
          images: [],
          owner: { display_name: "Allar" },
          items: { total: 119 },
          tracks: { total: 0 },
          uri: "spotify:playlist:1"
        });
      }
    });

    await expect(service.getPlaylist("user-1", "playlist-1")).resolves.toEqual(
      expect.objectContaining({
        trackCount: 119
      })
    );
  });
});
