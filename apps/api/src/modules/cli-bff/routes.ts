import { Elysia, t } from "elysia";
import { requireSession } from "../auth/session";
import type { AppAuth } from "../auth/service";
import type { SpotifyService } from "../spotify/service";
import { cliErrorResponses, toCliErrorPayload } from "./error-response";
import { createCliBffService } from "./service";

function renderAuthCallbackHtml(title: string, description: string) {
  return `<!doctype html><html><head><meta charset="utf-8" /><title>${title}</title></head><body><h1>${title}</h1><p>${description}</p></body></html>`;
}

async function handlePublicAuthCallback(
  query: {
    code?: string;
    state?: string;
    error?: string;
    error_description?: string;
  },
  completeAuthorizationFromCallback: (code: string, state: string) => Promise<unknown>
) {
  if (query.error) {
    const details = query.error_description ? `${query.error}: ${query.error_description}` : query.error;
    return new Response(renderAuthCallbackHtml("Spotify link failed", `Spotify returned: ${details}`), {
      status: 400,
      headers: { "content-type": "text/html; charset=utf-8" }
    });
  }

  if (!query.code || !query.state) {
    return new Response(renderAuthCallbackHtml("Spotify link failed", "Missing code or state in callback URL."), {
      status: 400,
      headers: { "content-type": "text/html; charset=utf-8" }
    });
  }

  try {
    await completeAuthorizationFromCallback(query.code, query.state);

    return new Response(renderAuthCallbackHtml("Spotify linked", "You can return to Clipify in your terminal."), {
      status: 200,
      headers: { "content-type": "text/html; charset=utf-8" }
    });
  } catch (error) {
    if (error instanceof Response) {
      const message = await error.text();
      return new Response(renderAuthCallbackHtml("Spotify link failed", message || "OAuth callback failed."), {
        status: error.status,
        headers: { "content-type": "text/html; charset=utf-8" }
      });
    }

    return new Response(renderAuthCallbackHtml("Spotify link failed", "Unexpected callback error."), {
      status: 500,
      headers: { "content-type": "text/html; charset=utf-8" }
    });
  }
}

export function cliBffModule(auth: AppAuth, spotify: SpotifyService) {
  const cli = createCliBffService(spotify);

  async function applyCliError(
    set: {
      status?: number | string;
    },
    error: unknown
  ) {
    const failure = await toCliErrorPayload(error);
    set.status = failure.status;
    return failure.body;
  }

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

  const playerHomeSummary = t.Object({
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
  });

  const playerSnapshotResponse = t.Object({
    home: playerHomeSummary,
    warning: t.String()
  });

  const bootstrapResponse = t.Object({
    home: playerHomeSummary,
    browse: t.Object({
      featuredPlaylists: t.Array(playlistSummary),
      playlists: t.Array(playlistSummary),
      likedTracks: t.Array(trackSummary)
    }),
    warning: t.String()
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
      async ({ request, set }) => {
        try {
          const session = await requireSession(auth, request);
          return await cli.startAuthorization(session.user.id);
        } catch (error) {
          return applyCliError(set, error);
        }
      },
      {
        detail: {
          tags: ["cli"],
          summary: "Start Spotify OAuth authorization flow for CLI"
        },
        response: {
          200: t.Object({
            authorizeUrl: t.String(),
            state: t.String()
          }),
          ...cliErrorResponses
        }
      }
    )
    .get(
      "/auth/status",
      async ({ request, set }) => {
        try {
          const session = await requireSession(auth, request);
          return await cli.getAuthorizationStatus(session.user.id);
        } catch (error) {
          return applyCliError(set, error);
        }
      },
      {
        detail: {
          tags: ["cli"],
          summary: "Get Spotify link status for authenticated CLI user"
        },
        response: {
          200: t.Object({
            linked: t.Boolean(),
            relinkRequired: t.Boolean()
          }),
          ...cliErrorResponses
        }
      }
    )
    .get(
      "/auth/callback/public",
      async ({ query }) => {
        return handlePublicAuthCallback(query, cli.completeAuthorizationFromCallback);
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
      async ({ request, set }) => {
        try {
          const session = await requireSession(auth, request);
          return await cli.getBootstrap(session.user);
        } catch (error) {
          return applyCliError(set, error);
        }
      },
      {
        detail: {
          tags: ["cli"],
          summary: "Get CLI bootstrap payload with home and browse data"
        },
        response: {
          200: bootstrapResponse,
          ...cliErrorResponses
        }
      }
    )
    .get(
      "/player/snapshot",
      async ({ request, set }) => {
        try {
          const session = await requireSession(auth, request);
          return await cli.getPlayerSnapshot(session.user);
        } catch (error) {
          return applyCliError(set, error);
        }
      },
      {
        detail: {
          tags: ["cli"],
          summary: "Get CLI player snapshot for polling"
        },
        response: {
          200: playerSnapshotResponse,
          ...cliErrorResponses
        }
      }
    )
    .get(
      "/view/library/:libraryId",
      async ({ request, params, set }) => {
        try {
          const session = await requireSession(auth, request);
          return await cli.getLibraryView(session.user.id, params.libraryId);
        } catch (error) {
          return applyCliError(set, error);
        }
      },
      {
        detail: {
          tags: ["cli"],
          summary: "Get a library detail section for CLI"
        },
        params: t.Object({
          libraryId: t.String()
        }),
        response: {
          200: t.Object({
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
          }),
          ...cliErrorResponses
        }
      }
    )
    .get(
      "/search",
      async ({ request, query, set }) => {
        try {
          const session = await requireSession(auth, request);
          return await cli.search(session.user.id, query.q);
        } catch (error) {
          return applyCliError(set, error);
        }
      },
      {
        detail: {
          tags: ["cli"],
          summary: "Search Spotify for the CLI view model"
        },
        query: t.Object({
          q: t.String({ minLength: 1 })
        }),
        response: {
          200: t.Object({
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
          }),
          ...cliErrorResponses
        }
      }
    )
    .get(
      "/devices",
      async ({ request, set }) => {
        try {
          const session = await requireSession(auth, request);
          return await cli.getDevices(session.user.id);
        } catch (error) {
          return applyCliError(set, error);
        }
      },
      {
        detail: {
          tags: ["cli"],
          summary: "Get Spotify devices for CLI"
        },
        response: {
          200: t.Object({
            items: t.Array(deviceSummary)
          }),
          ...cliErrorResponses
        }
      }
    )
    .post(
      "/player/action",
      async ({ request, body, set }) => {
        try {
          const session = await requireSession(auth, request);
          return await cli.runPlayerAction(session.user.id, body);
        } catch (error) {
          return applyCliError(set, error);
        }
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
        response: {
          200: playerActionResponse,
          ...cliErrorResponses
        }
      }
    );
}
