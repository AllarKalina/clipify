import { Elysia, t } from "elysia";
import { requireSession } from "../auth/session";
import type { AppAuth } from "../auth/service";
import type { SpotifyService } from "./service";

export function spotifyModule(auth: AppAuth, spotify: SpotifyService) {
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
          deviceName: t.String(),
          deviceType: t.String(),
          progressMs: t.Number(),
          durationMs: t.Number()
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
              trackName: t.String(),
              artistName: t.String(),
              albumName: t.String(),
              playedAt: t.String()
            })
          )
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
    );
}
