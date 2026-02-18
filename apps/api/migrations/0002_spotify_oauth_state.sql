CREATE TABLE IF NOT EXISTS "spotify_oauth_state" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL,
  "state_hash" text NOT NULL,
  "expires_at" timestamp NOT NULL,
  "created_at" timestamp NOT NULL,
  CONSTRAINT "spotify_oauth_state_state_hash_unique" UNIQUE("state_hash")
);

DO $$ BEGIN
 ALTER TABLE "spotify_oauth_state" ADD CONSTRAINT "spotify_oauth_state_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
