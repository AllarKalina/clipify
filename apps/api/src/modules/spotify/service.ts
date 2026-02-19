import { eq } from "drizzle-orm";
import type { AppEnv } from "../../config/env";
import type { AppDb } from "../../db/client";
import { spotifyConnections, spotifyOauthStates } from "../../db/schema";
import { createStateHash, createTokenCipher } from "./crypto";

export type SpotifyStartAuthResponse = {
  authorizeUrl: string;
  state: string;
};

export type SpotifyCallbackResponse = {
  linked: boolean;
  userId: string;
};

export type SpotifyAuthStatusResponse = {
  linked: boolean;
};

export type SpotifyCurrentlyPlayingResponse = {
  isPlaying: boolean;
  trackName: string;
  artistName: string;
  albumName: string;
};

export type SpotifyProfileResponse = {
  id: string;
  displayName: string;
  email: string;
  profileUrl: string;
  imageUrl: string;
};

export type SpotifyService = {
  isConfigured: () => boolean;
  startAuthorization: (userId: string) => Promise<SpotifyStartAuthResponse>;
  completeAuthorization: (userId: string, code: string, state: string) => Promise<SpotifyCallbackResponse>;
  completeAuthorizationFromCallback: (code: string, state: string) => Promise<SpotifyCallbackResponse>;
  getAuthorizationStatus: (userId: string) => Promise<SpotifyAuthStatusResponse>;
  getCurrentlyPlaying: (userId: string) => Promise<SpotifyCurrentlyPlayingResponse>;
  getProfile: (userId: string) => Promise<SpotifyProfileResponse>;
};

type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

type SpotifyConnection = {
  id: string;
  userId: string;
  spotifyUserId: string;
  accessToken: string;
  refreshToken: string;
  scope: string | null;
  tokenType: string | null;
  expiresAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

type SpotifyOAuthState = {
  id: string;
  userId: string;
  stateHash: string;
  expiresAt: Date;
  createdAt: Date;
};

type SpotifyConnectionStore = {
  findByUserId: (userId: string) => Promise<SpotifyConnection | null>;
  findBySpotifyUserId: (spotifyUserId: string) => Promise<SpotifyConnection | null>;
  upsertConnection: (connection: SpotifyConnection) => Promise<void>;
  createOauthState: (oauthState: SpotifyOAuthState) => Promise<void>;
  consumeOauthState: (stateHash: string, now: Date) => Promise<SpotifyOAuthState | null>;
};

type SpotifyServiceDeps = {
  store?: SpotifyConnectionStore;
  db?: AppDb;
  fetchImpl?: FetchLike;
  now?: () => Date;
  randomUUID?: () => string;
};

type SpotifyTokenResponse = {
  access_token: string;
  token_type: string;
  scope?: string;
  expires_in?: number;
  refresh_token?: string;
};

const REQUIRED_SCOPE = "user-read-private user-read-email user-read-playback-state";

function isExpired(expiresAt: Date | null, now: Date): boolean {
  if (!expiresAt) {
    return false;
  }

  return expiresAt.getTime() <= now.getTime() + 30_000;
}

function createDrizzleStore(db: AppDb): SpotifyConnectionStore {
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

function toExpiresAt(expiresIn: number | undefined, now: Date): Date | null {
  if (!expiresIn || expiresIn <= 0) {
    return null;
  }

  return new Date(now.getTime() + expiresIn * 1000);
}

async function parseTokenResponse(response: Response): Promise<SpotifyTokenResponse> {
  const text = await response.text();
  let payload: Partial<SpotifyTokenResponse> = {};
  if (text) {
    try {
      payload = JSON.parse(text) as Partial<SpotifyTokenResponse>;
    } catch {
      payload = {};
    }
  }

  if (!response.ok) {
    throw new Response(`Spotify token exchange failed (${response.status}): ${text || "empty response"}`, {
      status: 502
    });
  }

  if (!payload.access_token || !payload.token_type) {
    throw new Response("Invalid Spotify token response", { status: 502 });
  }

  return payload as SpotifyTokenResponse;
}

export function createSpotifyService(env: AppEnv, deps: SpotifyServiceDeps): SpotifyService {
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

  function requireCipher() {
    if (!env.SPOTIFY_TOKEN_ENCRYPTION_KEY) {
      throw new Response("Spotify token encryption key is missing", { status: 503 });
    }

    return createTokenCipher(env.SPOTIFY_TOKEN_ENCRYPTION_KEY);
  }

  async function exchangeCodeForToken(code: string): Promise<SpotifyTokenResponse> {
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
    isConfigured,
    async startAuthorization(userId: string) {
      if (!isConfigured()) {
        throw new Response("Spotify is not configured", { status: 503 });
      }

      const state = `${randomUUID()}.${randomUUID()}`;
      const at = now();
      await connectionStore.createOauthState({
        id: randomUUID(),
        userId,
        stateHash: createStateHash(state),
        expiresAt: new Date(at.getTime() + 10 * 60 * 1000),
        createdAt: at
      });

      const params = new URLSearchParams({
        client_id: env.SPOTIFY_CLIENT_ID!,
        response_type: "code",
        redirect_uri: env.SPOTIFY_REDIRECT_URI!,
        scope: REQUIRED_SCOPE,
        state,
        show_dialog: "true"
      });

      return {
        authorizeUrl: `https://accounts.spotify.com/authorize?${params.toString()}`,
        state
      };
    },
    async completeAuthorization(userId: string, code: string, state: string) {
      if (!isConfigured()) {
        throw new Response("Spotify is not configured", { status: 503 });
      }

      if (!code || !state) {
        throw new Response("Missing code or state", { status: 400 });
      }

      const consumedState = await connectionStore.consumeOauthState(createStateHash(state), now());
      if (!consumedState || consumedState.userId !== userId) {
        throw new Response("Invalid or expired Spotify state", { status: 400 });
      }

      return completeAuthorizationForUser(userId, code);
    },
    async completeAuthorizationFromCallback(code: string, state: string) {
      if (!isConfigured()) {
        throw new Response("Spotify is not configured", { status: 503 });
      }

      if (!code || !state) {
        throw new Response("Missing code or state", { status: 400 });
      }

      const consumedState = await connectionStore.consumeOauthState(createStateHash(state), now());
      if (!consumedState) {
        throw new Response("Invalid or expired Spotify state", { status: 400 });
      }

      return completeAuthorizationForUser(consumedState.userId, code);
    },
    async getAuthorizationStatus(userId: string) {
      const existing = await connectionStore.findByUserId(userId);
      return {
        linked: Boolean(existing)
      };
    },
    async getCurrentlyPlaying(userId: string) {
      if (!isConfigured()) {
        throw new Response("Spotify is not configured", { status: 503 });
      }

      const cipher = requireCipher();
      let connection = await ensureConnection(userId);
      let accessToken = cipher.decrypt(connection.accessToken);

      let response = await fetchImpl("https://api.spotify.com/v1/me/player/currently-playing", {
        headers: {
          authorization: `Bearer ${accessToken}`
        }
      });

      if (response.status === 401) {
        connection = await refreshAccessToken(connection);
        accessToken = cipher.decrypt(connection.accessToken);
        response = await fetchImpl("https://api.spotify.com/v1/me/player/currently-playing", {
          headers: {
            authorization: `Bearer ${accessToken}`
          }
        });
      }

      if (response.status === 204) {
        return {
          isPlaying: false,
          trackName: "",
          artistName: "",
          albumName: ""
        };
      }

      if (!response.ok) {
        const text = await response.text();
        throw new Response(`Spotify currently-playing request failed (${response.status}): ${text || "empty response"}`, {
          status: 502
        });
      }

      const payload = (await response.json()) as {
        is_playing?: boolean;
        item?: { name?: string; artists?: { name?: string }[]; album?: { name?: string } };
      };

      return {
        isPlaying: Boolean(payload.is_playing),
        trackName: payload.item?.name ?? "",
        artistName: payload.item?.artists?.[0]?.name ?? "",
        albumName: payload.item?.album?.name ?? ""
      };
    },
    async getProfile(userId: string) {
      if (!isConfigured()) {
        throw new Response("Spotify is not configured", { status: 503 });
      }

      const cipher = requireCipher();
      let connection = await ensureConnection(userId);
      let accessToken = cipher.decrypt(connection.accessToken);

      try {
        return await fetchSpotifyProfile(accessToken);
      } catch (error) {
        if (!(error instanceof Response) || error.status !== 401) {
          throw error;
        }
      }

      connection = await refreshAccessToken(connection);
      accessToken = cipher.decrypt(connection.accessToken);
      return fetchSpotifyProfile(accessToken);
    }
  };
}
