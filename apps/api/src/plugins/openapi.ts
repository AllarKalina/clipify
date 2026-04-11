import { openapi } from "@elysiajs/openapi";
import type { ElysiaOpenAPIConfig } from "@elysiajs/openapi";
import type { OpenAPIV3 } from "openapi-types";
import type { AppEnv } from "../config/env";
import {
  getAuthOpenApiPaths,
  getAuthOpenApiSchemas,
  getAuthOpenApiSecuritySchemes,
  getAuthOpenApiTags
} from "../modules/auth/service";

export function createOpenApiPlugin(env: AppEnv) {
  const documentation: NonNullable<ElysiaOpenAPIConfig["documentation"]> = {
    info: {
      title: env.APP_NAME,
      version: env.API_VERSION,
      description: "Clipify API and CLI BFF surface."
    },
    tags: [
      { name: "system", description: "Health and readiness endpoints" },
      { name: "public", description: "Public API metadata endpoints" },
      { name: "auth", description: "Email/password authentication endpoints" },
      { name: "user", description: "Authenticated user profile endpoints" },
      { name: "cli", description: "CLI BFF endpoints consumed by terminal app" },
      ...getAuthOpenApiTags()
    ],
    // `fromTypes(...)` was tested here and removed again because it emitted
    // generator warnings in this Bun monorepo. Route schemas remain the source
    // of truth, and Better Auth contributes its own generated OpenAPI paths.
    paths: getAuthOpenApiPaths() as Record<
      string,
      OpenAPIV3.PathItemObject | OpenAPIV3.ReferenceObject
    >,
    components: {
      securitySchemes: {
        apiKeyCookie: {
          type: "apiKey",
          in: "cookie",
          name: "better-auth.session_token",
          description: "Better Auth session cookie issued by /api/auth endpoints."
        },
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          description: "Better Auth bearer token authentication."
        },
        ...getAuthOpenApiSecuritySchemes()
      },
      schemas: getAuthOpenApiSchemas() as Record<
        string,
        OpenAPIV3.SchemaObject | OpenAPIV3.ReferenceObject
      >
    }
  } as any;

  return openapi({
    documentation,
    provider: env.NODE_ENV === "production" ? null : "scalar",
    path: "/openapi",
    specPath: "/openapi/json"
  });
}
