import { Elysia, t } from "elysia";
import { requireSession } from "../auth/session";
import type { AppAuth } from "../auth/service";
import type { SpotifyService } from "./service";

export function spotifyModule(auth: AppAuth, spotify: SpotifyService) {
  const playlistSummary = t.Object({
    id: t.String(),
    name: t.String(),
    description: t.String(),
    imageUrl: t.String(),
    ownerName: t.String(),
    trackCount: t.Number(),
    uri: t.String()
  });

  const trackSummary = t.Object({
    id: t.String(),
    trackName: t.String(),
    artistName: t.String(),
    albumName: t.String(),
    uri: t.String(),
    durationMs: t.Number()
  });

  const deviceSummary = t.Object({
    id: t.String(),
    name: t.String(),
    type: t.String(),
    isActive: t.Boolean(),
    isRestricted: t.Boolean(),
    supportsVolume: t.Boolean(),
    volumePercent: t.Number()
  });

  return new Elysia({ name: "spotify", prefix: "/v1/spotify" })
    .get(
      "/auth/start",
      async ({ request }) => {
        const session = await requireSession(auth, request);
        return spotify.startAuthorization(session.user.id);
      },
      {
        detail: {
          tags: ["spotify"],
          summary: "Start Spotify OAuth authorization flow"
        },
        response: t.Object({
          authorizeUrl: t.String(),
          state: t.String()
        })
      }
    )
    .get(
      "/auth/status",
      async ({ request }) => {
        const session = await requireSession(auth, request);
        return spotify.getAuthorizationStatus(session.user.id);
      },
      {
        detail: {
          tags: ["spotify"],
          summary: "Get Spotify link status for authenticated user"
        },
        response: t.Object({
          linked: t.Boolean()
        })
      }
    )
    .get(
      "/auth/callback",
      async ({ request, query }) => {
        const session = await requireSession(auth, request);
        return spotify.completeAuthorization(session.user.id, query.code, query.state);
      },
      {
        detail: {
          tags: ["spotify"],
          summary: "Handle Spotify OAuth callback for authenticated user"
        },
        query: t.Object({
          code: t.String(),
          state: t.String()
        }),
        response: t.Object({
          linked: t.Boolean(),
          userId: t.String()
        })
      }
    )
    .get(
      "/auth/callback/public",
      async ({ query }) => {
        const html = (title: string, description: string) =>
          `<!doctype html><html><head><meta charset="utf-8" /><title>${title}</title></head><body><h1>${title}</h1><p>${description}</p></body></html>`;

        if (query.error) {
          const details = query.error_description ? `${query.error}: ${query.error_description}` : query.error;
          return new Response(html("Spotify link failed", `Spotify returned: ${details}`), {
            status: 400,
            headers: { "content-type": "text/html; charset=utf-8" }
          });
        }

        if (!query.code || !query.state) {
          return new Response(html("Spotify link failed", "Missing code or state in callback URL."), {
            status: 400,
            headers: { "content-type": "text/html; charset=utf-8" }
          });
        }

        try {
          await spotify.completeAuthorizationFromCallback(query.code, query.state);

          return new Response(html("Spotify linked", "You can return to Clipify in your terminal."), {
            status: 200,
            headers: { "content-type": "text/html; charset=utf-8" }
          });
        } catch (error) {
          if (error instanceof Response) {
            const message = await error.text();
            return new Response(html("Spotify link failed", message || "OAuth callback failed."), {
              status: error.status,
              headers: { "content-type": "text/html; charset=utf-8" }
            });
          }

          return new Response(html("Spotify link failed", "Unexpected callback error."), {
            status: 500,
            headers: { "content-type": "text/html; charset=utf-8" }
          });
        }
      },
      {
        detail: {
          tags: ["spotify"],
          summary: "Public Spotify OAuth callback endpoint"
        },
        query: t.Object({
          code: t.Optional(t.String()),
          state: t.Optional(t.String()),
          error: t.Optional(t.String()),
          error_description: t.Optional(t.String())
        })
      }
    )
    .get(
      "/browse/featured-playlists",
      async ({ request }) => {
        const session = await requireSession(auth, request);
        return spotify.getFeaturedPlaylists(session.user.id);
      },
      {
        detail: {
          tags: ["spotify"],
          summary: "Get featured Spotify playlists for authenticated user"
        },
        response: t.Object({
          items: t.Array(playlistSummary)
        })
      }
    )
    .get(
      "/me",
      async ({ request }) => {
        const session = await requireSession(auth, request);
        return spotify.getProfile(session.user.id);
      },
      {
        detail: {
          tags: ["spotify"],
          summary: "Get Spotify profile for authenticated user"
        },
        response: t.Object({
          id: t.String(),
          displayName: t.String(),
          email: t.String(),
          profileUrl: t.String(),
          imageUrl: t.String()
        })
      }
    )
    .get(
      "/search",
      async ({ request, query }) => {
        const session = await requireSession(auth, request);
        return spotify.search(session.user.id, query.q);
      },
      {
        detail: {
          tags: ["spotify"],
          summary: "Search Spotify tracks, playlists, albums and artists for authenticated user"
        },
        query: t.Object({
          q: t.String({ minLength: 1 })
        }),
        response: t.Object({
          tracks: t.Array(trackSummary),
          playlists: t.Array(playlistSummary),
          albums: t.Array(
            t.Object({
              id: t.String(),
              name: t.String(),
              artistName: t.String(),
              imageUrl: t.String(),
              uri: t.String()
            })
          ),
          artists: t.Array(
            t.Object({
              id: t.String(),
              name: t.String(),
              imageUrl: t.String(),
              uri: t.String()
            })
          )
        })
      }
    )
    .get(
      "/me/playlists",
      async ({ request }) => {
        const session = await requireSession(auth, request);
        return spotify.getPlaylists(session.user.id);
      },
      {
        detail: {
          tags: ["spotify"],
          summary: "Get Spotify playlists for authenticated user"
        },
        response: t.Object({
          items: t.Array(playlistSummary)
        })
      }
    )
    .get(
      "/me/tracks",
      async ({ request }) => {
        const session = await requireSession(auth, request);
        return spotify.getSavedTracks(session.user.id);
      },
      {
        detail: {
          tags: ["spotify"],
          summary: "Get saved Spotify tracks for authenticated user"
        },
        response: t.Object({
          items: t.Array(trackSummary)
        })
      }
    )
    .get(
      "/playlists/:playlistId",
      async ({ request, params }) => {
        const session = await requireSession(auth, request);
        return spotify.getPlaylist(session.user.id, params.playlistId);
      },
      {
        detail: {
          tags: ["spotify"],
          summary: "Get Spotify playlist detail for authenticated user"
        },
        response: t.Object({
          ...playlistSummary.properties,
          tracks: t.Array(trackSummary)
        })
      }
    )
    .get(
      "/me/player/devices",
      async ({ request }) => {
        const session = await requireSession(auth, request);
        return spotify.getDevices(session.user.id);
      },
      {
        detail: {
          tags: ["spotify"],
          summary: "Get available Spotify devices for authenticated user"
        },
        response: t.Object({
          items: t.Array(deviceSummary)
        })
      }
    )
    .get(
      "/me/player/currently-playing",
      async ({ request }) => {
        const session = await requireSession(auth, request);
        return spotify.getCurrentlyPlaying(session.user.id);
      },
      {
        detail: {
          tags: ["spotify"],
          summary: "Get currently playing Spotify item for authenticated user"
        },
        response: t.Object({
          playbackState: t.Union([t.Literal("playing"), t.Literal("paused"), t.Literal("idle")]),
          isPlaying: t.Boolean(),
          trackName: t.String(),
          artistName: t.String(),
          albumName: t.String(),
          albumImageUrl: t.String(),
          deviceId: t.String(),
          deviceName: t.String(),
          deviceType: t.String(),
          deviceStatus: t.Union([t.Literal("active"), t.Literal("available"), t.Literal("restricted"), t.Literal("none")]),
          supportsVolume: t.Boolean(),
          volumePercent: t.Number(),
          shuffleEnabled: t.Boolean(),
          repeatMode: t.Union([t.Literal("off"), t.Literal("track"), t.Literal("context")]),
          progressMs: t.Number(),
          durationMs: t.Number()
        })
      }
    )
    .get(
      "/me/player/queue",
      async ({ request }) => {
        const session = await requireSession(auth, request);
        return spotify.getQueue(session.user.id);
      },
      {
        detail: {
          tags: ["spotify"],
          summary: "Get Spotify queue for authenticated user"
        },
        response: t.Object({
          items: t.Array(
            t.Object({
              trackName: t.String(),
              artistName: t.String(),
              albumName: t.String(),
              type: t.Union([t.Literal("track"), t.Literal("episode"), t.Literal("unknown")])
            })
          )
        })
      }
    )
    .get(
      "/me/player/recently-played",
      async ({ request }) => {
        const session = await requireSession(auth, request);
        return spotify.getRecentlyPlayed(session.user.id);
      },
      {
        detail: {
          tags: ["spotify"],
          summary: "Get recent Spotify playback history for authenticated user"
        },
        response: t.Object({
          items: t.Array(
            t.Object({
              id: t.String(),
              trackName: t.String(),
              artistName: t.String(),
              albumName: t.String(),
              uri: t.String(),
              durationMs: t.Number(),
              playedAt: t.String()
            })
          )
        })
      }
    )
    .post(
      "/me/player/play-track",
      async ({ request, query }) => {
        const session = await requireSession(auth, request);
        await spotify.playTrack(session.user.id, query.uri);
        return {
          ok: true as const,
          action: "play-track" as const
        };
      },
      {
        detail: {
          tags: ["spotify"],
          summary: "Start Spotify playback for a specific track"
        },
        query: t.Object({
          uri: t.String()
        }),
        response: t.Object({
          ok: t.Literal(true),
          action: t.Literal("play-track")
        })
      }
    )
    .post(
      "/me/player/play-context",
      async ({ request, query }) => {
        const session = await requireSession(auth, request);
        await spotify.playContext(session.user.id, query.contextUri);
        return {
          ok: true as const,
          action: "play-context" as const
        };
      },
      {
        detail: {
          tags: ["spotify"],
          summary: "Start Spotify playback for a context uri"
        },
        query: t.Object({
          contextUri: t.String()
        }),
        response: t.Object({
          ok: t.Literal(true),
          action: t.Literal("play-context")
        })
      }
    )
    .post(
      "/me/player/play",
      async ({ request }) => {
        const session = await requireSession(auth, request);
        await spotify.play(session.user.id);
        return {
          ok: true as const,
          action: "play" as const
        };
      },
      {
        detail: {
          tags: ["spotify"],
          summary: "Start or resume Spotify playback for authenticated user"
        },
        response: t.Object({
          ok: t.Literal(true),
          action: t.Literal("play")
        })
      }
    )
    .post(
      "/me/player/pause",
      async ({ request }) => {
        const session = await requireSession(auth, request);
        await spotify.pause(session.user.id);
        return {
          ok: true as const,
          action: "pause" as const
        };
      },
      {
        detail: {
          tags: ["spotify"],
          summary: "Pause Spotify playback for authenticated user"
        },
        response: t.Object({
          ok: t.Literal(true),
          action: t.Literal("pause")
        })
      }
    )
    .post(
      "/me/player/next",
      async ({ request }) => {
        const session = await requireSession(auth, request);
        await spotify.next(session.user.id);
        return {
          ok: true as const,
          action: "next" as const
        };
      },
      {
        detail: {
          tags: ["spotify"],
          summary: "Skip to next Spotify item for authenticated user"
        },
        response: t.Object({
          ok: t.Literal(true),
          action: t.Literal("next")
        })
      }
    )
    .post(
      "/me/player/previous",
      async ({ request }) => {
        const session = await requireSession(auth, request);
        await spotify.previous(session.user.id);
        return {
          ok: true as const,
          action: "previous" as const
        };
      },
      {
        detail: {
          tags: ["spotify"],
          summary: "Skip to previous Spotify item for authenticated user"
        },
        response: t.Object({
          ok: t.Literal(true),
          action: t.Literal("previous")
        })
      }
    )
    .put(
      "/me/player/transfer",
      async ({ request, query }) => {
        const session = await requireSession(auth, request);
        await spotify.transferPlayback(session.user.id, query.deviceId);
        return {
          ok: true as const,
          action: "transfer" as const
        };
      },
      {
        detail: {
          tags: ["spotify"],
          summary: "Transfer Spotify playback to a device for authenticated user"
        },
        query: t.Object({
          deviceId: t.String()
        }),
        response: t.Object({
          ok: t.Literal(true),
          action: t.Literal("transfer")
        })
      }
    )
    .put(
      "/me/player/shuffle",
      async ({ request, query }) => {
        const session = await requireSession(auth, request);
        await spotify.setShuffle(session.user.id, query.state === "true");
        return {
          ok: true as const,
          action: "shuffle" as const
        };
      },
      {
        detail: {
          tags: ["spotify"],
          summary: "Toggle Spotify shuffle for authenticated user"
        },
        query: t.Object({
          state: t.Union([t.Literal("true"), t.Literal("false")])
        }),
        response: t.Object({
          ok: t.Literal(true),
          action: t.Literal("shuffle")
        })
      }
    )
    .put(
      "/me/player/repeat",
      async ({ request, query }) => {
        const session = await requireSession(auth, request);
        await spotify.setRepeatMode(session.user.id, query.state);
        return {
          ok: true as const,
          action: "repeat" as const
        };
      },
      {
        detail: {
          tags: ["spotify"],
          summary: "Set Spotify repeat mode for authenticated user"
        },
        query: t.Object({
          state: t.Union([t.Literal("off"), t.Literal("track"), t.Literal("context")])
        }),
        response: t.Object({
          ok: t.Literal(true),
          action: t.Literal("repeat")
        })
      }
    )
    .put(
      "/me/player/volume",
      async ({ request, query }) => {
        const session = await requireSession(auth, request);
        await spotify.setVolume(session.user.id, query.volumePercent);
        return {
          ok: true as const,
          action: "volume" as const
        };
      },
      {
        detail: {
          tags: ["spotify"],
          summary: "Set Spotify volume for authenticated user"
        },
        query: t.Object({
          volumePercent: t.Numeric()
        }),
        response: t.Object({
          ok: t.Literal(true),
          action: t.Literal("volume")
        })
      }
    );
}
