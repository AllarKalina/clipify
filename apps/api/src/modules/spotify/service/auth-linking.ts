import type { SpotifyAuthStatusResponse, SpotifyCallbackResponse, SpotifyStartAuthResponse } from "../contracts";
import { createStateHash } from "./context";
import { isScopeFresh, REQUIRED_SCOPE, type SpotifyServiceContext } from "./shared";

export type SpotifyAuthLinkingService = {
  startAuthorization: (userId: string) => Promise<SpotifyStartAuthResponse>;
  completeAuthorization: (userId: string, code: string, state: string) => Promise<SpotifyCallbackResponse>;
  completeAuthorizationFromCallback: (code: string, state: string) => Promise<SpotifyCallbackResponse>;
  getAuthorizationStatus: (userId: string) => Promise<SpotifyAuthStatusResponse>;
};

export function createSpotifyAuthLinkingService(context: SpotifyServiceContext): SpotifyAuthLinkingService {
  return {
    async startAuthorization(userId) {
      context.requireConfigured();

      const state = `${context.randomUUID()}.${context.randomUUID()}`;
      const at = context.now();
      await context.store.createOauthState({
        id: context.randomUUID(),
        userId,
        stateHash: createStateHash(state),
        expiresAt: new Date(at.getTime() + 10 * 60 * 1000),
        createdAt: at
      });

      const params = new URLSearchParams({
        client_id: context.env.SPOTIFY_CLIENT_ID!,
        response_type: "code",
        redirect_uri: context.env.SPOTIFY_REDIRECT_URI!,
        scope: REQUIRED_SCOPE,
        state,
        show_dialog: "true"
      });

      return {
        authorizeUrl: `https://accounts.spotify.com/authorize?${params.toString()}`,
        state
      };
    },

    async completeAuthorization(userId, code, state) {
      context.requireConfigured();

      if (!code || !state) {
        throw new Response("Missing code or state", { status: 400 });
      }

      const consumedState = await context.store.consumeOauthState(createStateHash(state), context.now());
      if (!consumedState || consumedState.userId !== userId) {
        throw new Response("Invalid or expired Spotify state", { status: 400 });
      }

      return context.completeAuthorizationForUser(userId, code);
    },

    async completeAuthorizationFromCallback(code, state) {
      context.requireConfigured();

      if (!code || !state) {
        throw new Response("Missing code or state", { status: 400 });
      }

      const consumedState = await context.store.consumeOauthState(createStateHash(state), context.now());
      if (!consumedState) {
        throw new Response("Invalid or expired Spotify state", { status: 400 });
      }

      return context.completeAuthorizationForUser(consumedState.userId, code);
    },

    async getAuthorizationStatus(userId) {
      const existing = await context.store.findByUserId(userId);
      if (!existing) {
        return {
          linked: false,
          relinkRequired: false
        };
      }

      return {
        linked: true,
        relinkRequired: !isScopeFresh(existing.scope)
      };
    }
  };
}
