import { betterAuth, type BetterAuthOptions } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import type { AppEnv } from "../../config/env";
import type { AppDb } from "../../db/client";
import { authSchema } from "../../db/schema";

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
    emailAndPassword: {
      enabled: true
    },
    trustedOrigins: buildTrustedOrigins(env.BETTER_AUTH_URL)
  };

  return betterAuth(options);
}

export type AppAuth = ReturnType<typeof createAuth>;
