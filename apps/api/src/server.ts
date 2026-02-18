import { createApp } from "./app";
import { readEnv } from "./config/env";
import { createDb } from "./db/client";
import { createAuth } from "./modules/auth/service";
import { createSpotifyService } from "./modules/spotify/service";
import { createLogger } from "./plugins/logger";

const env = readEnv();
const logger = createLogger(env);
const { db, sql } = createDb(env);
const auth = createAuth(env, db);
const spotify = createSpotifyService(env, { db });

async function checkReadiness(): Promise<boolean> {
  try {
    await sql`select 1`;
    return true;
  } catch (error) {
    logger.error("db.readiness.failed", {
      error: error instanceof Error ? error.message : "unknown"
    });

    return false;
  }
}

const app = createApp({
  env,
  logger,
  auth,
  spotify,
  checkReadiness
});

app.listen({
  hostname: env.HOST,
  port: env.PORT
});

logger.info("server.listening", {
  host: env.HOST,
  port: env.PORT,
  app: env.APP_NAME,
  env: env.NODE_ENV
});
