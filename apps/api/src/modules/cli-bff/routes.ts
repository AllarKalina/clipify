import { Elysia, t } from "elysia";
import { requireSession } from "../auth/session";
import type { AppAuth } from "../auth/service";
import type { SpotifyService } from "../spotify/service";
import { createCliBffService } from "./service";

export function cliBffModule(auth: AppAuth, spotify: SpotifyService) {
  const cli = createCliBffService(spotify);

  const playlistSummary = t.Object({
    id: t.String(),
    name: t.String(),
    description: t.String(),
    imageUrl: t.String(),
    ownerName: t.String(),
    isPinned: t.Optional(t.Boolean()),
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

  const playerActionResponse = t.Object({
    ok: t.Literal(true),
    action: t.Union([
      t.Literal("play"),
      t.Literal("pause"),
      t.Literal("next"),
      t.Literal("previous"),
      t.Literal("shuffle"),
      t.Literal("repeat"),
      t.Literal("volume"),
      t.Literal("transfer"),
      t.Literal("play-track"),
      t.Literal("play-context")
    ])
  });

  return new Elysia({ name: "cli-bff", prefix: "/v1/cli" })
    .get(
      "/auth/start",
      async ({ request }) => {
        const session = await requireSession(auth, request);
        return cli.startAuthorization(session.user.id);
      },
      {
        detail: {
          tags: ["cli"],
          summary: "Start Spotify OAuth authorization flow for CLI"
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
        return cli.getAuthorizationStatus(session.user.id);
      },
      {
        detail: {
          tags: ["cli"],
          summary: "Get Spotify link status for authenticated CLI user"
        },
        response: t.Object({
          linked: t.Boolean(),
          relinkRequired: t.Boolean()
        })
      }
    )
    .get(
      "/auth/callback",
      async ({ request, query }) => {
        const session = await requireSession(auth, request);
        return cli.completeAuthorization(session.user.id, query.code, query.state);
      },
      {
        detail: {
          tags: ["cli"],
          summary: "Handle Spotify OAuth callback for authenticated CLI user"
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
          await cli.completeAuthorizationFromCallback(query.code, query.state);

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
          tags: ["cli"],
          summary: "Public Spotify OAuth callback endpoint for CLI"
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
      "/bootstrap",
      async ({ request }) => {
        const session = await requireSession(auth, request);
        return cli.getBootstrap(session.user);
      },
      {
        detail: {
          tags: ["cli"],
          summary: "Get CLI bootstrap payload with home and browse data"
        },
        response: t.Object({
          home: t.Object({
            spotify: t.Union([t.Literal("linked"), t.Literal("not-linked"), t.Literal("relink-required")]),
            userName: t.String(),
            userEmail: t.String(),
            spotifyDisplayName: t.String(),
            deviceId: t.String(),
            deviceName: t.String(),
            deviceType: t.String(),
            deviceStatus: t.Union([t.Literal("active"), t.Literal("available"), t.Literal("restricted"), t.Literal("none")]),
            supportsVolume: t.Boolean(),
            volumePercent: t.Number(),
            playbackState: t.Union([t.Literal("playing"), t.Literal("paused"), t.Literal("idle")]),
            shuffleEnabled: t.Boolean(),
            repeatMode: t.Union([t.Literal("off"), t.Literal("track"), t.Literal("context")]),
            trackName: t.String(),
            artistName: t.String(),
            albumName: t.String(),
            progressMs: t.Number(),
            durationMs: t.Number(),
            queueStatus: t.Union([t.Literal("ready"), t.Literal("no-device"), t.Literal("relink-required"), t.Literal("unavailable")]),
            queue: t.Array(
              t.Object({
                trackName: t.String(),
                artistName: t.String(),
                albumName: t.String(),
                type: t.Union([t.Literal("track"), t.Literal("episode"), t.Literal("unknown")])
              })
            ),
            recentUnavailable: t.Boolean(),
            recent: t.Array(
              t.Object({
                id: t.String(),
                trackName: t.String(),
                artistName: t.String(),
                albumName: t.String(),
                uri: t.String(),
                durationMs: t.Number(),
                playedAt: t.String()
              })
            ),
            linked: t.Boolean(),
            relinkRequired: t.Boolean(),
            profile: t.Nullable(
              t.Object({
                id: t.String(),
                displayName: t.String(),
                email: t.String(),
                profileUrl: t.String(),
                imageUrl: t.String()
              })
            )
          }),
          browse: t.Object({
            featuredPlaylists: t.Array(playlistSummary),
            playlists: t.Array(playlistSummary),
            likedTracks: t.Array(trackSummary)
          }),
          warning: t.String()
        })
      }
    )
    .get(
      "/view/home",
      async ({ request }) => {
        const session = await requireSession(auth, request);
        return cli.getHomeView(session.user.id);
      },
      {
        detail: {
          tags: ["cli"],
          summary: "Get home view sections for CLI"
        },
        response: t.Object({
          sections: t.Array(
            t.Object({
              id: t.Union([t.Literal("quick-launch"), t.Literal("picked")]),
              title: t.String(),
              items: t.Array(
                t.Object({
                  id: t.String(),
                  title: t.String(),
                  subtitle: t.String(),
                  meta: t.String(),
                  action: t.Union([
                    t.Object({
                      type: t.Literal("play-context"),
                      uri: t.String()
                    }),
                    t.Object({
                      type: t.Literal("open-playlist"),
                      playlistId: t.String()
                    })
                  ])
                })
              )
            })
          )
        })
      }
    )
    .get(
      "/view/library/:libraryId",
      async ({ request, params }) => {
        const session = await requireSession(auth, request);
        return cli.getLibraryView(session.user.id, params.libraryId);
      },
      {
        detail: {
          tags: ["cli"],
          summary: "Get a library detail section for CLI"
        },
        params: t.Object({
          libraryId: t.String()
        }),
        response: t.Object({
          section: t.Nullable(
            t.Object({
              id: t.String(),
              title: t.String(),
              items: t.Array(
                t.Object({
                  id: t.String(),
                  title: t.String(),
                  subtitle: t.String(),
                  meta: t.Optional(t.String()),
                  action: t.Object({
                    type: t.Literal("play-track"),
                    uri: t.String()
                  })
                })
              )
            })
          )
        })
      }
    )
    .get(
      "/search",
      async ({ request, query }) => {
        const session = await requireSession(auth, request);
        return cli.search(session.user.id, query.q);
      },
      {
        detail: {
          tags: ["cli"],
          summary: "Search Spotify for the CLI view model"
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
      "/devices",
      async ({ request }) => {
        const session = await requireSession(auth, request);
        return cli.getDevices(session.user.id);
      },
      {
        detail: {
          tags: ["cli"],
          summary: "Get Spotify devices for CLI"
        },
        response: t.Object({
          items: t.Array(deviceSummary)
        })
      }
    )
    .post(
      "/player/action",
      async ({ request, body }) => {
        const session = await requireSession(auth, request);
        return cli.runPlayerAction(session.user.id, body);
      },
      {
        detail: {
          tags: ["cli"],
          summary: "Run a normalized player action for CLI"
        },
        body: t.Union([
          t.Object({ action: t.Literal("play") }),
          t.Object({ action: t.Literal("pause") }),
          t.Object({ action: t.Literal("next") }),
          t.Object({ action: t.Literal("previous") }),
          t.Object({ action: t.Literal("shuffle"), enabled: t.Boolean() }),
          t.Object({ action: t.Literal("repeat"), mode: t.Union([t.Literal("off"), t.Literal("track"), t.Literal("context")]) }),
          t.Object({ action: t.Literal("volume"), volumePercent: t.Number() }),
          t.Object({ action: t.Literal("transfer"), deviceId: t.String() }),
          t.Object({ action: t.Literal("play-track"), uri: t.String() }),
          t.Object({ action: t.Literal("play-context"), contextUri: t.String() })
        ]),
        response: playerActionResponse
      }
    );
}
