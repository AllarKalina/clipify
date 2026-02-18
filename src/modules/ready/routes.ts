import { Elysia, t } from "elysia";

export function readyModule(checkReady: () => Promise<boolean>) {
  return new Elysia({ name: "ready" }).get(
    "/ready",
    async () => {
      const ready = await checkReady();

      if (!ready) {
        throw new Response(
          JSON.stringify({
            status: "not_ready"
          }),
          {
            status: 503,
            headers: { "content-type": "application/json" }
          }
        );
      }

      return {
        status: "ready"
      };
    },
    {
      detail: {
        tags: ["system"],
        summary: "Readiness check"
      },
      response: {
        200: t.Object({
          status: t.String()
        }),
        503: t.Object({
          status: t.String()
        })
      }
    }
  );
}
