import { Elysia, t } from "elysia";
import { rateLimit } from "elysia-rate-limit";
import { requireSession } from "../auth/session";
import type { AppAuth } from "../auth/service";
import type { SpotifyService } from "../spotify/service";
import { withRequestIdHeader } from "../../plugins/openapi-headers";
import { buildRateLimitKey } from "../../plugins/rate-limit-key";
import {
  cliBffModels,
  cliModelNames
} from "./schemas";
import { CliBffError, cliErrorResponseSchema, cliErrorModels, createCliBffError, toCliErrorPayload } from "./error-response";
import { createCliBffService } from "./service";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function normalizeHtmlMessage(value: string): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= 500) {
    return normalized;
  }

  return `${normalized.slice(0, 500)}…`;
}

function renderAuthCallbackHtml(title: string, description: string) {
  const safeTitle = escapeHtml(normalizeHtmlMessage(title));
  const safeDescription = escapeHtml(normalizeHtmlMessage(description));
  return `<!doctype html><html><head><meta charset="utf-8" /><title>${safeTitle}</title></head><body><h1>${safeTitle}</h1><p>${safeDescription}</p></body></html>`;
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

type CliBffModuleOptions = {
  trustProxyHeaders?: boolean;
};

export function cliBffModule(auth: AppAuth, spotify: SpotifyService, options: CliBffModuleOptions = {}) {
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

  return new Elysia({
    name: "cli-bff",
    prefix: "/v1/cli",
    tags: ["cli"]
  })
    .model(cliErrorModels)
    .model(cliBffModels)
    .error({
      CliBffError
    })
    .macro({
      cliDetail(summary: string, description?: string) {
        return {
          detail: {
            summary,
            description: description ?? summary
          }
        };
      }
    })
    .onError(async ({ code, error, set }) => {
      if (code === "VALIDATION") {
        return applyCliError(set, createCliBffError(400, "INVALID_INPUT", "Invalid request."));
      }

      if (code === "CliBffError") {
        return applyCliError(set, error);
      }

      return applyCliError(set, error);
    })
    .get(
      "/auth/callback/public",
      async ({ query }) => {
        return handlePublicAuthCallback(query, cli.completeAuthorizationFromCallback);
      },
      {
        cliDetail: "Public Spotify OAuth callback endpoint for CLI",
        query: cliModelNames.authCallbackQuery
      }
    )
    .guard(
      {
        detail: {
          description: "Requires an authenticated Better Auth session.",
          security: [
            {
              apiKeyCookie: []
            }
          ]
        },
        response: {
          400: withRequestIdHeader(cliErrorResponseSchema),
          401: withRequestIdHeader(cliErrorResponseSchema),
          403: withRequestIdHeader(cliErrorResponseSchema),
          404: withRequestIdHeader(cliErrorResponseSchema),
          409: withRequestIdHeader(cliErrorResponseSchema),
          429: withRequestIdHeader(cliErrorResponseSchema),
          500: withRequestIdHeader(cliErrorResponseSchema),
          502: withRequestIdHeader(cliErrorResponseSchema),
          503: withRequestIdHeader(cliErrorResponseSchema)
        }
      },
      (protectedCli) =>
        protectedCli
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
          .get(
            "/auth/start",
            async ({ session }) => {
              return await cli.startAuthorization(session.id);
            },
            {
              cliDetail: "Start Spotify OAuth authorization flow for CLI",
              response: {
                200: withRequestIdHeader(t.Ref(cliModelNames.authStartResponse))
              }
            }
          )
          .get(
            "/auth/status",
            async ({ session }) => {
              return await cli.getAuthorizationStatus(session.id);
            },
            {
              cliDetail: "Get Spotify link status for authenticated CLI user",
              response: {
                200: withRequestIdHeader(t.Ref(cliModelNames.authStatusResponse))
              }
            }
          )
          .get(
            "/bootstrap",
            async ({ session }) => {
              return await cli.getBootstrap(session);
            },
            {
              cliDetail: "Get CLI bootstrap payload with home and browse data",
              response: {
                200: withRequestIdHeader(t.Ref(cliModelNames.bootstrapResponse))
              }
            }
          )
          .get(
            "/player/snapshot",
            async ({ session }) => {
              return await cli.getPlayerSnapshot(session);
            },
            {
              cliDetail: "Get CLI player snapshot for polling",
              response: {
                200: withRequestIdHeader(t.Ref(cliModelNames.playerSnapshotResponse))
              }
            }
          )
          .get(
            "/view/library/:libraryId",
            async ({ session, params }) => {
              return await cli.getLibraryView(session.id, params.libraryId);
            },
            {
              cliDetail: "Get a library detail section for CLI",
              params: cliModelNames.libraryViewParams,
              response: {
                200: withRequestIdHeader(t.Ref(cliModelNames.libraryViewResponse))
              }
            }
          )
          .group(
            "/search",
            (searchScope) =>
              searchScope
                .use(
                  rateLimit({
                    scoping: "local",
                    duration: 60_000,
                    max: 30,
                    generator: (request) =>
                      buildRateLimitKey(request, {
                        scope: "search",
                        allowSessionCookie: true,
                        trustProxyHeaders: options.trustProxyHeaders
                      }),
                    responseCode: 429,
                    responseMessage: {
                      error: {
                        code: "RATE_LIMITED",
                        message: "Too many search requests. Please wait and try again."
                      }
                    }
                  })
                )
                .get(
                  "",
                  async ({ session, query }: { session: { id: string }; query: { q: string } }) => {
                    return await cli.search(session.id, query.q);
                  },
                  {
                    cliDetail: "Search Spotify for the CLI view model",
                    query: cliModelNames.searchQuery,
                    response: {
                      200: withRequestIdHeader(t.Ref(cliModelNames.searchResponse))
                    }
                  }
                )
          )
          .get(
            "/devices",
            async ({ session }) => {
              return await cli.getDevices(session.id);
            },
            {
              cliDetail: "Get Spotify devices for CLI",
              response: {
                200: withRequestIdHeader(t.Ref(cliModelNames.devicesResponse))
              }
            }
          )
          .post(
            "/player/action",
            async ({ session, body }) => {
              return await cli.runPlayerAction(session.id, body);
            },
            {
              cliDetail: "Run a normalized player action for CLI",
              body: cliModelNames.playerActionRequest,
              response: {
                200: withRequestIdHeader(t.Ref(cliModelNames.playerActionResponse))
              }
            }
          )
    );
}
