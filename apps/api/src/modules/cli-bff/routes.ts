import { Elysia } from "elysia";
import { requireSession } from "../auth/session";
import type { AppAuth } from "../auth/service";
import type { SpotifyService } from "../spotify/service";
import {
  cliAuthCallbackQuerySchema,
  cliAuthStartResponseSchema,
  cliAuthStatusResponseSchema,
  cliBootstrapResponseSchema,
  cliDevicesResponseSchema,
  cliLibraryViewParamsSchema,
  cliLibraryViewResponseSchema,
  cliPlayerActionRequestSchema,
  cliPlayerActionResponseSchema,
  cliPlayerSnapshotResponseSchema,
  cliSearchQuerySchema,
  cliSearchResponseSchema
} from "./schemas";
import { createCliBffError, cliErrorResponses, toCliErrorPayload } from "./error-response";
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

  const protectedCli = new Elysia({ name: "cli-bff-protected" })
    .derive(async ({ request }) => {
      try {
        const session = await requireSession(auth, request);
        return {
          session: session.user
        };
      } catch (error) {
        if (error instanceof Response && error.status === 401) {
          throw createCliBffError(401, "UNAUTHORIZED", "Unauthorized. Please log in again.");
        }

        throw error;
      }
    })
    .onError(({ error, set }) => applyCliError(set, error))
    .get(
      "/auth/start",
      async ({ session }) => {
        return await cli.startAuthorization(session.id);
      },
      {
        detail: {
          tags: ["cli"],
          summary: "Start Spotify OAuth authorization flow for CLI"
        },
        response: {
          200: cliAuthStartResponseSchema,
          ...cliErrorResponses
        }
      }
    )
    .get(
      "/auth/status",
      async ({ session }) => {
        return await cli.getAuthorizationStatus(session.id);
      },
      {
        detail: {
          tags: ["cli"],
          summary: "Get Spotify link status for authenticated CLI user"
        },
        response: {
          200: cliAuthStatusResponseSchema,
          ...cliErrorResponses
        }
      }
    )
    .get(
      "/bootstrap",
      async ({ session }) => {
        return await cli.getBootstrap(session);
      },
      {
        detail: {
          tags: ["cli"],
          summary: "Get CLI bootstrap payload with home and browse data"
        },
        response: {
          200: cliBootstrapResponseSchema,
          ...cliErrorResponses
        }
      }
    )
    .get(
      "/player/snapshot",
      async ({ session }) => {
        return await cli.getPlayerSnapshot(session);
      },
      {
        detail: {
          tags: ["cli"],
          summary: "Get CLI player snapshot for polling"
        },
        response: {
          200: cliPlayerSnapshotResponseSchema,
          ...cliErrorResponses
        }
      }
    )
    .get(
      "/view/library/:libraryId",
      async ({ session, params }) => {
        return await cli.getLibraryView(session.id, params.libraryId);
      },
      {
        detail: {
          tags: ["cli"],
          summary: "Get a library detail section for CLI"
        },
        params: cliLibraryViewParamsSchema,
        response: {
          200: cliLibraryViewResponseSchema,
          ...cliErrorResponses
        }
      }
    )
    .get(
      "/search",
      async ({ session, query }) => {
        return await cli.search(session.id, query.q);
      },
      {
        detail: {
          tags: ["cli"],
          summary: "Search Spotify for the CLI view model"
        },
        query: cliSearchQuerySchema,
        response: {
          200: cliSearchResponseSchema,
          ...cliErrorResponses
        }
      }
    )
    .get(
      "/devices",
      async ({ session }) => {
        return await cli.getDevices(session.id);
      },
      {
        detail: {
          tags: ["cli"],
          summary: "Get Spotify devices for CLI"
        },
        response: {
          200: cliDevicesResponseSchema,
          ...cliErrorResponses
        }
      }
    )
    .post(
      "/player/action",
      async ({ session, body }) => {
        return await cli.runPlayerAction(session.id, body);
      },
      {
        detail: {
          tags: ["cli"],
          summary: "Run a normalized player action for CLI"
        },
        body: cliPlayerActionRequestSchema,
        response: {
          200: cliPlayerActionResponseSchema,
          ...cliErrorResponses
        }
      }
    );

  return new Elysia({ name: "cli-bff", prefix: "/v1/cli" })
    .onError(({ error, set }) => applyCliError(set, error))
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
        query: cliAuthCallbackQuerySchema
      }
    )
    .use(protectedCli);
}
