import { Elysia, t } from "elysia";
import type { AppAuth } from "../auth/service";
import { requireSession } from "../auth/session";
import { withRequestIdHeader } from "../../plugins/openapi-headers";

export function userModule(auth: AppAuth) {
  const unauthorizedResponseSchema = t.Object({
    error: t.Object({
      code: t.Literal("UNAUTHORIZED"),
      message: t.String()
    })
  });

  return new Elysia({
    name: "user",
    tags: ["user"]
  }).get(
    "/v1/me",
    async ({ request, set }) => {
      let session;

      try {
        session = await requireSession(auth, request);
      } catch (error) {
        if (error instanceof Response && error.status === 401) {
          set.status = 401;
          return {
            error: {
              code: "UNAUTHORIZED" as const,
              message: "Unauthorized. Please log in again."
            }
          };
        }

        throw error;
      }

      return {
        user: {
          id: session.user.id,
          email: session.user.email,
          name: session.user.name
        }
      };
    },
    {
      detail: {
        summary: "Current user profile",
        security: [
          {
            apiKeyCookie: []
          }
        ]
      },
      response: {
        200: withRequestIdHeader(t.Object({
          user: t.Object({
            id: t.String(),
            email: t.String(),
            name: t.String()
          })
        })),
        401: withRequestIdHeader(unauthorizedResponseSchema)
      }
    }
  );
}
