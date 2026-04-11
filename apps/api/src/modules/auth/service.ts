import { betterAuth, type BetterAuthOptions } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { openAPI as betterAuthOpenAPI } from "better-auth/plugins";
import type { AppEnv } from "../../config/env";
import type { AppDb } from "../../db/client";
import { authSchema } from "../../db/schema";

type BetterAuthOpenApiSchema = {
  tags?: Array<{ name: string; description?: string }>;
  paths: Record<string, unknown>;
  components?: {
    schemas?: Record<string, unknown>;
    securitySchemes?: Record<string, unknown>;
  };
};

const AUTH_OPENAPI_PREFIX = "/api/auth";

const authOpenApiState: {
  loaded: boolean;
  loading: Promise<void> | null;
  paths: Record<string, unknown>;
  schemas: Record<string, unknown>;
  securitySchemes: Record<string, unknown>;
  tags: Array<{ name: string; description?: string }>;
} = {
  loaded: false,
  loading: null,
  paths: {},
  schemas: {},
  securitySchemes: {},
  tags: []
};

function syncAuthOpenApiState(schema: BetterAuthOpenApiSchema) {
  for (const [path, value] of Object.entries(schema.paths)) {
    authOpenApiState.paths[`${AUTH_OPENAPI_PREFIX}${path}`] = value;
  }

  Object.assign(authOpenApiState.schemas, schema.components?.schemas ?? {});
  Object.assign(authOpenApiState.securitySchemes, schema.components?.securitySchemes ?? {});

  for (const tag of schema.tags ?? []) {
    if (!authOpenApiState.tags.some((current) => current.name === tag.name)) {
      authOpenApiState.tags.push({
        name: tag.name,
        description: tag.description
      });
    }
  }
}

export function getAuthOpenApiPaths() {
  return authOpenApiState.paths;
}

export function getAuthOpenApiSchemas() {
  return authOpenApiState.schemas;
}

export function getAuthOpenApiSecuritySchemes() {
  return authOpenApiState.securitySchemes;
}

export function getAuthOpenApiTags() {
  return authOpenApiState.tags;
}

export async function waitForAuthOpenApiSchema() {
  if (authOpenApiState.loading) {
    await authOpenApiState.loading;
  }
}

export function buildTrustedOrigins(baseUrl: string): string[] {
  const url = new URL(baseUrl);
  const origins = new Set([url.origin]);
  const hostname = url.hostname;

  const loopbackAliases =
    hostname === "localhost"
      ? ["127.0.0.1", "[::1]"]
      : hostname === "127.0.0.1" || hostname === "[::1]" || hostname === "::1"
        ? ["localhost", "127.0.0.1", "[::1]"]
        : [];

  for (const alias of loopbackAliases) {
    const aliasUrl = new URL(url.toString());
    aliasUrl.hostname = alias;
    origins.add(aliasUrl.origin);
  }

  return [...origins];
}

export function createAuth(env: AppEnv, db: AppDb) {
  const options: BetterAuthOptions = {
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,
    database: drizzleAdapter(db, {
      provider: "pg",
      schema: authSchema
    }),
    plugins: [
      betterAuthOpenAPI({
        disableDefaultReference: true
      })
    ],
    emailAndPassword: {
      enabled: true
    },
    trustedOrigins: buildTrustedOrigins(env.BETTER_AUTH_URL)
  };

  const auth = betterAuth(options);
  const authApiWithOpenApi = auth.api as typeof auth.api & {
    generateOpenAPISchema?: () => Promise<BetterAuthOpenApiSchema>;
  };

  if (!authOpenApiState.loaded && !authOpenApiState.loading && authApiWithOpenApi.generateOpenAPISchema) {
    authOpenApiState.loading = authApiWithOpenApi.generateOpenAPISchema()
      .then((schema) => {
        syncAuthOpenApiState(schema);
        authOpenApiState.loaded = true;
      })
      .finally(() => {
        authOpenApiState.loading = null;
      });
  }

  return auth;
}

export type AppAuth = ReturnType<typeof createAuth>;
