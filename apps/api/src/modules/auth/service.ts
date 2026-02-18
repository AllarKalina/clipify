import { betterAuth, type BetterAuthOptions } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import type { AppEnv } from "../../config/env";
import type { AppDb } from "../../db/client";
import { authSchema } from "../../db/schema";

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
    trustedOrigins: [env.BETTER_AUTH_URL]
  };

  return betterAuth(options);
}

export type AppAuth = ReturnType<typeof createAuth>;
