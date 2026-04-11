import { Elysia, t } from "elysia";
import { withRequestIdHeader } from "../../plugins/openapi-headers";

export function readyModule(checkReady: () => Promise<boolean>) {
  return new Elysia({
    name: "ready",
    tags: ["system"]
  }).get(
    "/ready",
    async ({ set }) => {
      const ready = await checkReady();

      if (!ready) {
        set.status = 503;
        return {
          status: "not_ready"
        };
      }

      return {
        status: "ready"
      };
    },
    {
      detail: {
        summary: "Readiness check"
      },
      response: {
        200: withRequestIdHeader(t.Object({
          status: t.String()
        })),
        503: withRequestIdHeader(t.Object({
          status: t.String()
        }))
      }
    }
  );
}
