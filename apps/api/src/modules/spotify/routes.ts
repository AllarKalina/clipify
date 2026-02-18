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
          isPlaying: t.Boolean(),
          trackName: t.String(),
          artistName: t.String(),
          albumName: t.String()
        })
      }
    );
}
