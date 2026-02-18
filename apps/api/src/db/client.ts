import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import type { AppEnv } from "../config/env";
import * as schema from "./schema";

export type AppDb = PostgresJsDatabase<typeof schema>;

export function createDb(env: AppEnv): { db: AppDb; sql: postgres.Sql } {
  const sql = postgres(env.DATABASE_URL, {
    max: 10,
    prepare: false
  });

  const db = drizzle(sql, { schema });

  return { db, sql };
}
