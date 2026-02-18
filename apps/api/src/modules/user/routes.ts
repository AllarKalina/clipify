import { Elysia, t } from "elysia";
import type { AppAuth } from "../auth/service";
import { requireSession } from "../auth/session";

export function userModule(auth: AppAuth) {
  return new Elysia({ name: "user" }).get(
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
        tags: ["user"],
        summary: "Current user profile"
      },
      response: {
        200: t.Object({
          user: t.Object({
            id: t.String(),
            email: t.String(),
            name: t.String()
          })
        }),
        401: t.String()
      }
    }
  );
}
