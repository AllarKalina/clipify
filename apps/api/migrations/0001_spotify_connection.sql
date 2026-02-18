CREATE TABLE IF NOT EXISTS "spotify_connection" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL,
  "spotify_user_id" text NOT NULL,
  "access_token" text NOT NULL,
  "refresh_token" text NOT NULL,
  "scope" text,
  "token_type" text,
  "expires_at" timestamp,
  "created_at" timestamp NOT NULL,
  "updated_at" timestamp NOT NULL,
  CONSTRAINT "spotify_connection_user_id_unique" UNIQUE("user_id"),
  CONSTRAINT "spotify_connection_spotify_user_id_unique" UNIQUE("spotify_user_id")
);

DO $$ BEGIN
 ALTER TABLE "spotify_connection" ADD CONSTRAINT "spotify_connection_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
