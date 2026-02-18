import { eq } from "drizzle-orm";
import type { AppEnv } from "../../config/env";
import type { AppDb } from "../../db/client";
import { spotifyConnections } from "../../db/schema";

export type SpotifyStartAuthResponse = {
  authorizeUrl: string;
  state: string;
};

export type SpotifyCallbackResponse = {
  linked: boolean;
  userId: string;
};

export type SpotifyCurrentlyPlayingResponse = {
  isPlaying: boolean;
  trackName: string;
  artistName: string;
  albumName: string;
};

export type SpotifyService = {
  isConfigured: () => boolean;
  startAuthorization: (userId: string) => SpotifyStartAuthResponse;
  completeAuthorization: (userId: string, code: string, state: string) => Promise<SpotifyCallbackResponse>;
  getCurrentlyPlaying: (userId: string) => Promise<SpotifyCurrentlyPlayingResponse>;
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

type SpotifyConnectionStore = {
  findByUserId: (userId: string) => Promise<SpotifyConnection | null>;
  findBySpotifyUserId: (spotifyUserId: string) => Promise<SpotifyConnection | null>;
  upsert: (connection: SpotifyConnection) => Promise<void>;
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

const REQUIRED_SCOPE = "user-read-email user-read-playback-state";

function encodeState(payload: string): string {
  return Buffer.from(payload, "utf-8").toString("base64url");
}

function decodeState(value: string): string {
  return Buffer.from(value, "base64url").toString("utf-8");
}

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
    async upsert(connection) {
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
  const payload = text ? (JSON.parse(text) as Partial<SpotifyTokenResponse>) : {};

  if (!response.ok) {
    throw new Response("Spotify token exchange failed", { status: 502 });
  }

  if (!payload.access_token || !payload.token_type) {
    throw new Response("Invalid Spotify token response", { status: 502 });
  }

  return payload as SpotifyTokenResponse;
}

export function createSpotifyService(env: AppEnv, deps: SpotifyServiceDeps): SpotifyService {
  const { fetchImpl = fetch, now = () => new Date(), randomUUID = () => crypto.randomUUID() } = deps;
  const store = deps.store ?? (deps.db ? createDrizzleStore(deps.db) : null);

  const isConfigured = () =>
    Boolean(env.SPOTIFY_CLIENT_ID && env.SPOTIFY_CLIENT_SECRET && env.SPOTIFY_REDIRECT_URI);

  if (!store) {
    throw new Error("Spotify service requires a database or custom store");
  }
  const connectionStore = store;

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

  async function refreshAccessToken(connection: SpotifyConnection): Promise<SpotifyConnection> {
    const response = await fetchImpl("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: {
        authorization: `Basic ${Buffer.from(`${env.SPOTIFY_CLIENT_ID!}:${env.SPOTIFY_CLIENT_SECRET!}`).toString("base64")}`,
        "content-type": "application/x-www-form-urlencoded"
      },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: connection.refreshToken
      })
    });

    const token = await parseTokenResponse(response);
    const at = now();
    const updated: SpotifyConnection = {
      ...connection,
      accessToken: token.access_token,
      refreshToken: token.refresh_token ?? connection.refreshToken,
      tokenType: token.token_type,
      scope: token.scope ?? connection.scope,
      expiresAt: toExpiresAt(token.expires_in, at),
      updatedAt: at
    };

      await connectionStore.upsert(updated);
      return updated;
  }

  async function fetchSpotifyProfile(accessToken: string): Promise<{ id: string }> {
    const response = await fetchImpl("https://api.spotify.com/v1/me", {
      headers: {
        authorization: `Bearer ${accessToken}`
      }
    });

    if (!response.ok) {
      throw new Response("Spotify profile fetch failed", { status: 502 });
    }

    const payload = (await response.json()) as { id?: string };
    if (!payload.id) {
      throw new Response("Spotify profile payload missing id", { status: 502 });
    }

    return { id: payload.id };
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

  return {
    isConfigured,
    startAuthorization(userId: string) {
      if (!isConfigured()) {
        throw new Response("Spotify is not configured", { status: 503 });
      }

      const issuedAt = now().getTime().toString();
      const nonce = randomUUID();
      const state = encodeState(`${userId}:${nonce}:${issuedAt}`);
      const params = new URLSearchParams({
        client_id: env.SPOTIFY_CLIENT_ID!,
        response_type: "code",
        redirect_uri: env.SPOTIFY_REDIRECT_URI!,
        scope: REQUIRED_SCOPE,
        state
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

      let stateUserId = "";
      try {
        const decoded = decodeState(state);
        [stateUserId] = decoded.split(":");
      } catch {
        throw new Response("Invalid Spotify state", { status: 400 });
      }

      if (stateUserId !== userId) {
        throw new Response("Invalid Spotify state", { status: 400 });
      }

      const token = await exchangeCodeForToken(code);
      const profile = await fetchSpotifyProfile(token.access_token);
      const existing = await connectionStore.findBySpotifyUserId(profile.id);

      if (existing && existing.userId !== userId) {
        throw new Response("Spotify account already linked to another user", { status: 409 });
      }

      const at = now();

      const connection: SpotifyConnection = {
        id: existing?.id ?? randomUUID(),
        userId,
        spotifyUserId: profile.id,
        accessToken: token.access_token,
        refreshToken: token.refresh_token ?? existing?.refreshToken ?? "",
        tokenType: token.token_type,
        scope: token.scope ?? REQUIRED_SCOPE,
        expiresAt: toExpiresAt(token.expires_in, at),
        createdAt: existing?.createdAt ?? at,
        updatedAt: at
      };

      if (!connection.refreshToken) {
        throw new Response("Spotify refresh token missing", { status: 502 });
      }

      await connectionStore.upsert(connection);

      return {
        linked: true,
        userId
      };
    },
    async getCurrentlyPlaying(userId: string) {
      if (!isConfigured()) {
        throw new Response("Spotify is not configured", { status: 503 });
      }

      let connection = await ensureConnection(userId);
      let response = await fetchImpl("https://api.spotify.com/v1/me/player/currently-playing", {
        headers: {
          authorization: `Bearer ${connection.accessToken}`
        }
      });

      if (response.status === 401) {
        connection = await refreshAccessToken(connection);
        response = await fetchImpl("https://api.spotify.com/v1/me/player/currently-playing", {
          headers: {
            authorization: `Bearer ${connection.accessToken}`
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
        throw new Response("Spotify currently-playing request failed", { status: 502 });
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
    }
  };
}
