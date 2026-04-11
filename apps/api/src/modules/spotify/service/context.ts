import type { AppEnv } from "../../../config/env";
import { createStateHash, createTokenCipher } from "../crypto";
import type { SpotifyCallbackResponse, SpotifyProfileResponse } from "../contracts";
import {
  isExpired,
  parseTokenResponse,
  REQUIRED_SCOPE,
  toExpiresAt,
  type SpotifyConnection,
  type SpotifyServiceContext,
  type SpotifyServiceDeps
} from "./shared";
import { createDrizzleStore } from "./store";

export function createSpotifyServiceContext(env: AppEnv, deps: SpotifyServiceDeps): SpotifyServiceContext {
  const { fetchImpl = fetch, now = () => new Date(), randomUUID = () => crypto.randomUUID() } = deps;
  const store = deps.store ?? (deps.db ? createDrizzleStore(deps.db) : null);

  if (!store) {
    throw new Error("Spotify service requires a database or custom store");
  }
  const connectionStore = store;

  const isConfigured = () =>
    Boolean(
      env.SPOTIFY_CLIENT_ID && env.SPOTIFY_CLIENT_SECRET && env.SPOTIFY_REDIRECT_URI && env.SPOTIFY_TOKEN_ENCRYPTION_KEY
    );

  const requireConfigured = () => {
    if (!isConfigured()) {
      throw new Response("Spotify is not configured", { status: 503 });
    }
  };

  const requireCipher = () => {
    if (!env.SPOTIFY_TOKEN_ENCRYPTION_KEY) {
      throw new Response("Spotify token encryption key is missing", { status: 503 });
    }

    return createTokenCipher(env.SPOTIFY_TOKEN_ENCRYPTION_KEY);
  };

  async function exchangeCodeForToken(code: string) {
    const body = new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: env.SPOTIFY_REDIRECT_URI!
    });

    const response = await fetchImpl("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: {
        authorization: `Basic ${Buffer.from(`${env.SPOTIFY_CLIENT_ID!}:${env.SPOTIFY_CLIENT_SECRET!}`).toString("base64")}`,
        "content-type": "application/x-www-form-urlencoded"
      },
      body
    });

    return parseTokenResponse(response);
  }

  async function fetchSpotifyProfile(accessToken: string): Promise<SpotifyProfileResponse> {
    const response = await fetchImpl("https://api.spotify.com/v1/me", {
      headers: {
        authorization: `Bearer ${accessToken}`
      }
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Response(`Spotify profile fetch failed (${response.status}): ${text || "empty response"}`, {
        status: response.status === 401 ? 401 : 502
      });
    }

    const payload = (await response.json()) as {
      id?: string;
      display_name?: string | null;
      email?: string | null;
      external_urls?: { spotify?: string };
      images?: Array<{ url?: string }>;
    };
    if (!payload.id) {
      throw new Response("Spotify profile payload missing id", { status: 502 });
    }

    return {
      id: payload.id,
      displayName: payload.display_name ?? payload.id,
      email: payload.email ?? "",
      profileUrl: payload.external_urls?.spotify ?? "",
      imageUrl: payload.images?.[0]?.url ?? ""
    };
  }

  async function refreshAccessToken(connection: SpotifyConnection): Promise<SpotifyConnection> {
    const cipher = requireCipher();
    const refreshToken = cipher.decrypt(connection.refreshToken);

    const response = await fetchImpl("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: {
        authorization: `Basic ${Buffer.from(`${env.SPOTIFY_CLIENT_ID!}:${env.SPOTIFY_CLIENT_SECRET!}`).toString("base64")}`,
        "content-type": "application/x-www-form-urlencoded"
      },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: refreshToken
      })
    });

    const token = await parseTokenResponse(response);
    const at = now();
    const updated: SpotifyConnection = {
      ...connection,
      accessToken: cipher.encrypt(token.access_token),
      refreshToken: cipher.encrypt(token.refresh_token ?? refreshToken),
      tokenType: token.token_type,
      scope: token.scope ?? connection.scope,
      expiresAt: toExpiresAt(token.expires_in, at),
      updatedAt: at
    };

    await connectionStore.upsertConnection(updated);
    return updated;
  }

  async function ensureConnection(userId: string): Promise<SpotifyConnection> {
    const connection = await connectionStore.findByUserId(userId);
    if (!connection) {
      throw new Response("Spotify account not linked", { status: 409 });
    }

    if (isExpired(connection.expiresAt, now())) {
      return refreshAccessToken(connection);
    }

    return connection;
  }

  async function fetchSpotifyWithRetry(userId: string, input: string, init?: RequestInit) {
    const cipher = requireCipher();
    let connection = await ensureConnection(userId);
    let accessToken = cipher.decrypt(connection.accessToken);

    let response = await fetchImpl(input, {
      ...init,
      headers: {
        ...(init?.headers ?? {}),
        authorization: `Bearer ${accessToken}`
      }
    });

    if (response.status === 401) {
      connection = await refreshAccessToken(connection);
      accessToken = cipher.decrypt(connection.accessToken);
      response = await fetchImpl(input, {
        ...init,
        headers: {
          ...(init?.headers ?? {}),
          authorization: `Bearer ${accessToken}`
        }
      });
    }

    return {
      connection,
      accessToken,
      response
    };
  }

  async function completeAuthorizationForUser(userId: string, code: string): Promise<SpotifyCallbackResponse> {
    const token = await exchangeCodeForToken(code);
    const profile = await fetchSpotifyProfile(token.access_token);
    const existing = await connectionStore.findBySpotifyUserId(profile.id);

    if (existing && existing.userId !== userId) {
      throw new Response("Spotify account already linked to another user", { status: 409 });
    }

    const cipher = requireCipher();
    const at = now();
    const connection: SpotifyConnection = {
      id: existing?.id ?? randomUUID(),
      userId,
      spotifyUserId: profile.id,
      accessToken: cipher.encrypt(token.access_token),
      refreshToken: cipher.encrypt(token.refresh_token ?? ""),
      tokenType: token.token_type,
      scope: token.scope ?? REQUIRED_SCOPE,
      expiresAt: toExpiresAt(token.expires_in, at),
      createdAt: existing?.createdAt ?? at,
      updatedAt: at
    };

    if (!token.refresh_token && !existing?.refreshToken) {
      throw new Response("Spotify refresh token missing", { status: 502 });
    }

    if (!token.refresh_token && existing?.refreshToken) {
      connection.refreshToken = existing.refreshToken;
    }

    await connectionStore.upsertConnection(connection);

    return {
      linked: true,
      userId
    };
  }

  return {
    env,
    store: connectionStore,
    fetchImpl,
    now,
    randomUUID,
    isConfigured,
    requireConfigured,
    fetchSpotifyWithRetry,
    ensureConnection,
    refreshAccessToken,
    exchangeCodeForToken,
    fetchSpotifyProfile,
    completeAuthorizationForUser
  };
}

export { createStateHash };
