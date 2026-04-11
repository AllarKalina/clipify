import { createTokenCipher } from "../crypto";
import type { SpotifyProfileResponse } from "../contracts";
import { type SpotifyServiceContext } from "./shared";

export type SpotifyProfileService = {
  getProfile: (userId: string) => Promise<SpotifyProfileResponse>;
};

export function createSpotifyProfileService(context: SpotifyServiceContext): SpotifyProfileService {
  return {
    async getProfile(userId) {
      context.requireConfigured();

      let connection = await context.ensureConnection(userId);
      const encryptionKey = context.env.SPOTIFY_TOKEN_ENCRYPTION_KEY;
      if (!encryptionKey) {
        throw new Response("Spotify token encryption key is missing", { status: 503 });
      }

      const tokenCipher = createTokenCipher(encryptionKey);
      let decryptedToken = tokenCipher.decrypt(connection.accessToken);

      try {
        return await context.fetchSpotifyProfile(decryptedToken);
      } catch (error) {
        if (!(error instanceof Response) || error.status !== 401) {
          throw error;
        }
      }

      connection = await context.refreshAccessToken(connection);
      decryptedToken = tokenCipher.decrypt(connection.accessToken);
      return context.fetchSpotifyProfile(decryptedToken);
    }
  };
}
