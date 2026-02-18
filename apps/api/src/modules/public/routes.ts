import { Elysia, t } from "elysia";
import type { AppEnv } from "../../config/env";
import type { PublicExampleResponse, PublicVersionResponse } from "./contracts";

export function publicModule(env: AppEnv) {
  return new Elysia({ name: "public" })
    .get(
      "/v1/public/example",
      (): PublicExampleResponse => ({
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
    )
    .get(
      "/v1/public/meta/version",
      (): PublicVersionResponse => ({
        appName: env.APP_NAME,
        apiVersion: env.API_VERSION,
        minCliVersion: env.MIN_CLI_VERSION,
        latestCliVersion: env.LATEST_CLI_VERSION
      }),
      {
        detail: {
          tags: ["public"],
          summary: "Public API and CLI compatibility metadata"
        },
        response: t.Object({
          appName: t.String(),
          apiVersion: t.String(),
          minCliVersion: t.String(),
          latestCliVersion: t.String()
        })
      }
    );
}
