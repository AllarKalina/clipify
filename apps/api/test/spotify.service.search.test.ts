import { describe, expect, test } from "bun:test";
import { createSpotifyService } from "../src/modules/spotify/service";
import { baseEnv, createLinkedSpotifyService, createMemoryStore, grantedScope } from "./spotify.service.test-support";

describe("spotify service search", () => {
  test("returns normalized spotify search results for linked user", async () => {
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

    const searchService = createSpotifyService(baseEnv(), {
      store,
      fetchImpl: async (url) => {
        if (String(url).includes("/search")) {
          return Response.json({
            tracks: {
              items: [
                {
                  id: "track-1",
                  name: "Dreams",
                  artists: [{ name: "Fleetwood Mac" }],
                  album: { name: "Rumours" },
                  uri: "spotify:track:1",
                  duration_ms: 257000
                }
              ]
            },
            playlists: {
              items: [
                {
                  id: "playlist-1",
                  name: "Roadtrip",
                  description: "",
                  images: [],
                  owner: { display_name: "Allar" },
                  tracks: { total: 12 },
                  uri: "spotify:playlist:1"
                }
              ]
            },
            albums: {
              items: [
                {
                  id: "album-1",
                  name: "Rumours",
                  artists: [{ name: "Fleetwood Mac" }],
                  images: [],
                  uri: "spotify:album:1"
                }
              ]
            },
            artists: {
              items: [
                {
                  id: "artist-1",
                  name: "Fleetwood Mac",
                  images: [],
                  uri: "spotify:artist:1"
                }
              ]
            }
          });
        }

        return Response.json({});
      }
    });

    await expect(searchService.search("user-1", "dreams")).resolves.toEqual({
      tracks: [
        {
          id: "track-1",
          trackName: "Dreams",
          artistName: "Fleetwood Mac",
          albumName: "Rumours",
          uri: "spotify:track:1",
          durationMs: 257000
        }
      ],
      playlists: [
        {
          id: "playlist-1",
          name: "Roadtrip",
          description: "",
          imageUrl: "",
          ownerName: "Allar",
          isPinned: undefined,
          trackCount: 12,
          uri: "spotify:playlist:1"
        }
      ],
      albums: [
        {
          id: "album-1",
          name: "Rumours",
          artistName: "Fleetwood Mac",
          imageUrl: "",
          uri: "spotify:album:1"
        }
      ],
      artists: [
        {
          id: "artist-1",
          name: "Fleetwood Mac",
          imageUrl: "",
          uri: "spotify:artist:1"
        }
      ]
    });
  });
});
