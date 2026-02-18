import { Elysia, t } from "elysia";

export function publicModule() {
  return new Elysia({ name: "public" }).get(
    "/v1/public/example",
    () => ({
      id: "example-1",
      title: "Public Example",
      category: "demo"
    }),
    {
      detail: {
        tags: ["public"],
        summary: "Public hard-coded example payload"
      },
      response: t.Object({
        id: t.String(),
        title: t.String(),
        category: t.String()
      })
    }
  );
}
