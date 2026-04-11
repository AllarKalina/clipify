import { eq } from "drizzle-orm";
import { spotifyConnections, spotifyOauthStates } from "../../../db/schema";
import type { AppDb } from "../../../db/client";
import type { SpotifyConnectionStore } from "./shared";

export function createDrizzleStore(db: AppDb): SpotifyConnectionStore {
  return {
    async findByUserId(userId) {
      const [row] = await db.select().from(spotifyConnections).where(eq(spotifyConnections.userId, userId)).limit(1);
      return row || null;
    },
    async findBySpotifyUserId(spotifyUserId) {
      const [row] = await db
        .select()
        .from(spotifyConnections)
        .where(eq(spotifyConnections.spotifyUserId, spotifyUserId))
        .limit(1);
      return row || null;
    },
    async upsertConnection(connection) {
      await db
        .insert(spotifyConnections)
        .values(connection)
        .onConflictDoUpdate({
          target: spotifyConnections.userId,
          set: {
            spotifyUserId: connection.spotifyUserId,
            accessToken: connection.accessToken,
            refreshToken: connection.refreshToken,
            scope: connection.scope,
            tokenType: connection.tokenType,
            expiresAt: connection.expiresAt,
            updatedAt: connection.updatedAt
          }
        });
    },
    async createOauthState(oauthState) {
      await db.insert(spotifyOauthStates).values(oauthState);
    },
    async consumeOauthState(stateHash, now) {
      const [row] = await db
        .select()
        .from(spotifyOauthStates)
        .where(eq(spotifyOauthStates.stateHash, stateHash))
        .limit(1);

      if (!row || row.expiresAt.getTime() <= now.getTime()) {
        return null;
      }

      await db.delete(spotifyOauthStates).where(eq(spotifyOauthStates.id, row.id));
      return row;
    }
  };
}
