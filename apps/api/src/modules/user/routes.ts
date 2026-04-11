import { Elysia, t } from "elysia";
import type { AppAuth } from "../auth/service";
import { requireSession } from "../auth/session";
import { withRequestIdHeader } from "../../plugins/openapi-headers";

export function userModule(auth: AppAuth) {
  return new Elysia({
    name: "user",
    tags: ["user"]
  }).get(
    "/v1/me",
    async ({ request }) => {
      const session = await requireSession(auth, request);

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
        401: withRequestIdHeader(t.String())
      }
    }
  );
}
