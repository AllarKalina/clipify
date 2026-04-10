import { eq } from "drizzle-orm";
import type { AppEnv } from "../../config/env";
import type { AppDb } from "../../db/client";
import { spotifyConnections, spotifyOauthStates } from "../../db/schema";
import type {
  SpotifyAlbumSummary,
  SpotifyArtistSummary,
  SpotifyAuthStatusResponse,
  SpotifyCallbackResponse,
  SpotifyDeviceSummary,
  SpotifyDeviceStatus,
  SpotifyDevicesResponse,
  SpotifyFeaturedPlaylistsResponse,
  SpotifyPlaylistDetailResponse,
  SpotifyPlaylistSummary,
  SpotifyPlayerAction,
  SpotifyPlayerActionResponse,
  SpotifyCurrentlyPlayingResponse,
  SpotifyPlaylistsResponse,
  SpotifyQueueResponse,
  SpotifyProfileResponse,
  SpotifyRepeatMode,
  SpotifyRecentlyPlayedResponse,
  SpotifySavedTracksResponse,
  SpotifySearchResponse,
  SpotifyStartAuthResponse
} from "./contracts";
import { createStateHash, createTokenCipher } from "./crypto";

export type SpotifyService = {
  isConfigured: () => boolean;
  startAuthorization: (userId: string) => Promise<SpotifyStartAuthResponse>;
  completeAuthorization: (userId: string, code: string, state: string) => Promise<SpotifyCallbackResponse>;
  completeAuthorizationFromCallback: (code: string, state: string) => Promise<SpotifyCallbackResponse>;
  getAuthorizationStatus: (userId: string) => Promise<SpotifyAuthStatusResponse>;
  getCurrentlyPlaying: (userId: string) => Promise<SpotifyCurrentlyPlayingResponse>;
  getDevices: (userId: string) => Promise<SpotifyDevicesResponse>;
  getQueue: (userId: string) => Promise<SpotifyQueueResponse>;
  getRecentlyPlayed: (userId: string) => Promise<SpotifyRecentlyPlayedResponse>;
  getFeaturedPlaylists: (userId: string) => Promise<SpotifyFeaturedPlaylistsResponse>;
  getPlaylists: (userId: string) => Promise<SpotifyPlaylistsResponse>;
  getSavedTracks: (userId: string) => Promise<SpotifySavedTracksResponse>;
  getPlaylist: (userId: string, playlistId: string) => Promise<SpotifyPlaylistDetailResponse>;
  search: (userId: string, query: string) => Promise<SpotifySearchResponse>;
  play: (userId: string) => Promise<SpotifyPlayerActionResponse>;
  pause: (userId: string) => Promise<SpotifyPlayerActionResponse>;
  next: (userId: string) => Promise<SpotifyPlayerActionResponse>;
  previous: (userId: string) => Promise<SpotifyPlayerActionResponse>;
  playTrack: (userId: string, uri: string) => Promise<SpotifyPlayerActionResponse>;
  playContext: (userId: string, contextUri: string) => Promise<SpotifyPlayerActionResponse>;
  transferPlayback: (userId: string, deviceId: string) => Promise<SpotifyPlayerActionResponse>;
  setShuffle: (userId: string, enabled: boolean) => Promise<SpotifyPlayerActionResponse>;
  setRepeatMode: (userId: string, mode: SpotifyRepeatMode) => Promise<SpotifyPlayerActionResponse>;
  setVolume: (userId: string, volumePercent: number) => Promise<SpotifyPlayerActionResponse>;
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

const REQUIRED_SCOPE =
  "user-read-private user-read-email user-read-playback-state user-read-recently-played user-modify-playback-state";

type SpotifyApiCallResult = {
  connection: SpotifyConnection;
  accessToken: string;
  response: Response;
};

type SpotifyDevicePayload = {
  id?: string;
  is_active?: boolean;
  is_restricted?: boolean;
  name?: string;
  supports_volume?: boolean;
  type?: string;
  volume_percent?: number | null;
};

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

async function readSpotifyError(response: Response): Promise<string> {
  const text = await response.text();
  return text || "empty response";
}

function clampVolume(volumePercent: number): number {
  return Math.max(0, Math.min(100, Math.round(volumePercent)));
}

function summarizeDevice(device: SpotifyDevicePayload): SpotifyDeviceSummary {
  return {
    id: device.id ?? "",
    name: device.name ?? "",
    type: device.type ?? "",
    isActive: Boolean(device.is_active),
    isRestricted: Boolean(device.is_restricted),
    supportsVolume: Boolean(device.supports_volume),
    volumePercent: clampVolume(device.volume_percent ?? 0)
  };
}

function toDeviceStatus(device: SpotifyDeviceSummary | null): SpotifyDeviceStatus {
  if (!device) {
    return "none";
  }

  if (device.isRestricted) {
    return "restricted";
  }

  if (device.isActive) {
    return "active";
  }

  return "available";
}

function toRepeatMode(value: string | undefined): SpotifyRepeatMode {
  if (value === "track" || value === "context") {
    return value;
  }

  return "off";
}

function summarizePlaylist(item: {
  id?: string;
  name?: string;
  description?: string | null;
  images?: Array<{ url?: string }>;
  owner?: { display_name?: string | null };
  tracks?: { total?: number };
  uri?: string;
}): SpotifyPlaylistSummary {
  return {
    id: item.id ?? "",
    name: item.name ?? "",
    description: item.description ?? "",
    imageUrl: item.images?.[0]?.url ?? "",
    ownerName: item.owner?.display_name ?? "",
    trackCount: item.tracks?.total ?? 0,
    uri: item.uri ?? ""
  };
}

function summarizeTrack(item: {
  id?: string;
  name?: string;
  artists?: Array<{ name?: string }>;
  album?: { name?: string };
  uri?: string;
  duration_ms?: number;
}) {
  return {
    id: item.id ?? "",
    trackName: item.name ?? "",
    artistName: item.artists?.[0]?.name ?? "",
    albumName: item.album?.name ?? "",
    uri: item.uri ?? "",
    durationMs: item.duration_ms ?? 0
  };
}

function summarizeAlbum(item: {
  id?: string;
  name?: string;
  artists?: Array<{ name?: string }>;
  images?: Array<{ url?: string }>;
  uri?: string;
}): SpotifyAlbumSummary {
  return {
    id: item.id ?? "",
    name: item.name ?? "",
    artistName: item.artists?.[0]?.name ?? "",
    imageUrl: item.images?.[0]?.url ?? "",
    uri: item.uri ?? ""
  };
}

function summarizeArtist(item: { id?: string; name?: string; images?: Array<{ url?: string }>; uri?: string }): SpotifyArtistSummary {
  return {
    id: item.id ?? "",
    name: item.name ?? "",
    imageUrl: item.images?.[0]?.url ?? "",
    uri: item.uri ?? ""
  };
}

function parsePlayerFailure(text: string): { status: number; message: string } {
  const lowered = text.toLowerCase();
  if (lowered.includes("no active device")) {
    return {
      status: 409,
      message: "No active Spotify device. Start playback in Spotify first."
    };
  }

  if (lowered.includes("restriction violated") || lowered.includes("restricted")) {
    return {
      status: 409,
      message: "Playback is restricted on the current Spotify device."
    };
  }

  if (lowered.includes("premium")) {
    return {
      status: 403,
      message: "Spotify Premium is required for this playback control."
    };
  }

  if (lowered.includes("insufficient client scope")) {
    return {
      status: 403,
      message: "Playback control needs a fresh Spotify re-link."
    };
  }

  return {
    status: 502,
    message: text || "Spotify player request failed."
  };
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

  async function fetchSpotifyWithRetry(userId: string, input: string, init?: RequestInit): Promise<SpotifyApiCallResult> {
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

  async function runPlayerAction(userId: string, action: SpotifyPlayerAction): Promise<SpotifyPlayerActionResponse> {
    if (!isConfigured()) {
      throw new Response("Spotify is not configured", { status: 503 });
    }

    const path =
      action === "play"
        ? "play"
        : action === "pause"
          ? "pause"
          : action === "next"
          ? "next"
            : "previous";
    const method = action === "play" || action === "pause" ? "PUT" : "POST";
    const { response } = await fetchSpotifyWithRetry(userId, `https://api.spotify.com/v1/me/player/${path}`, {
      method
    });

    if (!response.ok) {
      const failure = parsePlayerFailure(await readSpotifyError(response));
      throw new Response(failure.message, { status: failure.status });
    }

    return {
      ok: true,
      action
    };
  }

  async function runPlayerSettingAction(
    userId: string,
    action: "shuffle" | "repeat" | "volume",
    query: Record<string, string>
  ): Promise<SpotifyPlayerActionResponse> {
    if (!isConfigured()) {
      throw new Response("Spotify is not configured", { status: 503 });
    }

    const url = new URL(`https://api.spotify.com/v1/me/player/${action}`);
    for (const [key, value] of Object.entries(query)) {
      url.searchParams.set(key, value);
    }

    const { response } = await fetchSpotifyWithRetry(userId, url.toString(), {
      method: "PUT"
    });

    if (!response.ok) {
      const failure = parsePlayerFailure(await readSpotifyError(response));
      throw new Response(failure.message, { status: failure.status });
    }

    return {
      ok: true,
      action
    };
  }

  async function runPlayPayloadAction(
    userId: string,
    action: "play-track" | "play-context",
    payload: Record<string, unknown>
  ): Promise<SpotifyPlayerActionResponse> {
    if (!isConfigured()) {
      throw new Response("Spotify is not configured", { status: 503 });
    }

    const { response } = await fetchSpotifyWithRetry(userId, "https://api.spotify.com/v1/me/player/play", {
      method: "PUT",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const failure = parsePlayerFailure(await readSpotifyError(response));
      throw new Response(failure.message, { status: failure.status });
    }

    return {
      ok: true,
      action
    };
  }

  async function fetchDevices(userId: string): Promise<SpotifyDeviceSummary[]> {
    const { response } = await fetchSpotifyWithRetry(userId, "https://api.spotify.com/v1/me/player/devices");

    if (!response.ok) {
      const text = await response.text();
      throw new Response(`Spotify devices request failed (${response.status}): ${text || "empty response"}`, {
        status: response.status === 401 ? 401 : 502
      });
    }

    const payload = (await response.json()) as {
      devices?: SpotifyDevicePayload[];
    };

    return (payload.devices ?? []).map((device) => summarizeDevice(device));
  }

  function pickPrimaryDevice(devices: SpotifyDeviceSummary[]): SpotifyDeviceSummary | null {
    return devices.find((device) => device.isActive) ?? devices.find((device) => !device.isRestricted) ?? devices[0] ?? null;
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
    async getDevices(userId: string) {
      if (!isConfigured()) {
        throw new Response("Spotify is not configured", { status: 503 });
      }

      return {
        items: await fetchDevices(userId)
      };
    },
    async getCurrentlyPlaying(userId: string) {
      if (!isConfigured()) {
        throw new Response("Spotify is not configured", { status: 503 });
      }

      const [{ response }, devices] = await Promise.all([
        fetchSpotifyWithRetry(userId, "https://api.spotify.com/v1/me/player"),
        fetchDevices(userId)
      ]);

      const primaryDevice = pickPrimaryDevice(devices);

      const baseDevice = {
        deviceId: primaryDevice?.id ?? "",
        deviceName: primaryDevice?.name ?? "",
        deviceType: primaryDevice?.type ?? "",
        deviceStatus: toDeviceStatus(primaryDevice),
        supportsVolume: primaryDevice?.supportsVolume ?? false,
        volumePercent: primaryDevice?.volumePercent ?? 0,
        shuffleEnabled: false,
        repeatMode: "off" as const
      };

      if (response.status === 204) {
        return {
          playbackState: "idle",
          isPlaying: false,
          trackName: "",
          artistName: "",
          albumName: "",
          albumImageUrl: "",
          ...baseDevice,
          progressMs: 0,
          durationMs: 0
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
        shuffle_state?: boolean;
        repeat_state?: string;
        progress_ms?: number;
        device?: {
          id?: string;
          is_active?: boolean;
          is_restricted?: boolean;
          name?: string;
          supports_volume?: boolean;
          type?: string;
          volume_percent?: number | null;
        };
        item?: {
          name?: string;
          duration_ms?: number;
          artists?: { name?: string }[];
          album?: { name?: string; images?: { url?: string }[] };
        };
      };

      const currentDevice = payload.device ? summarizeDevice(payload.device) : null;
      const resolvedDevice = currentDevice
        ? {
            deviceId: currentDevice.id || baseDevice.deviceId,
            deviceName: currentDevice.name || baseDevice.deviceName,
            deviceType: currentDevice.type || baseDevice.deviceType,
            deviceStatus: toDeviceStatus(currentDevice),
            supportsVolume: currentDevice.supportsVolume,
            volumePercent: currentDevice.volumePercent
          }
        : baseDevice;

      return {
        playbackState: payload.item?.name ? (payload.is_playing ? "playing" : "paused") : "idle",
        isPlaying: Boolean(payload.is_playing),
        trackName: payload.item?.name ?? "",
        artistName: payload.item?.artists?.[0]?.name ?? "",
        albumName: payload.item?.album?.name ?? "",
        albumImageUrl: payload.item?.album?.images?.[0]?.url ?? "",
        deviceId: resolvedDevice.deviceId,
        deviceName: resolvedDevice.deviceName,
        deviceType: resolvedDevice.deviceType,
        deviceStatus: resolvedDevice.deviceStatus,
        supportsVolume: resolvedDevice.supportsVolume,
        volumePercent: resolvedDevice.volumePercent,
        shuffleEnabled: Boolean(payload.shuffle_state),
        repeatMode: toRepeatMode(payload.repeat_state),
        progressMs: payload.progress_ms ?? 0,
        durationMs: payload.item?.duration_ms ?? 0
      };
    },
    async getQueue(userId: string) {
      if (!isConfigured()) {
        throw new Response("Spotify is not configured", { status: 503 });
      }

      const { response } = await fetchSpotifyWithRetry(userId, "https://api.spotify.com/v1/me/player/queue");

      if (response.status === 204) {
        return { items: [] };
      }

      if (!response.ok) {
        const failure = parsePlayerFailure(await readSpotifyError(response));
        throw new Response(failure.message, { status: failure.status });
      }

      const payload = (await response.json()) as {
        queue?: Array<{
          type?: string;
          name?: string;
          artists?: { name?: string }[];
          show?: { publisher?: string };
          album?: { name?: string };
        }>;
      };

      return {
        items: (payload.queue ?? []).slice(0, 5).map((item) => ({
          trackName: item.name ?? "",
          artistName: item.artists?.[0]?.name ?? item.show?.publisher ?? "",
          albumName: item.album?.name ?? "",
          type: item.type === "track" || item.type === "episode" ? item.type : "unknown"
        }))
      };
    },
    async getRecentlyPlayed(userId: string) {
      if (!isConfigured()) {
        throw new Response("Spotify is not configured", { status: 503 });
      }

      const cipher = requireCipher();
      let connection = await ensureConnection(userId);
      let accessToken = cipher.decrypt(connection.accessToken);

      let response = await fetchImpl("https://api.spotify.com/v1/me/player/recently-played?limit=5", {
        headers: {
          authorization: `Bearer ${accessToken}`
        }
      });

      if (response.status === 401) {
        connection = await refreshAccessToken(connection);
        accessToken = cipher.decrypt(connection.accessToken);
        response = await fetchImpl("https://api.spotify.com/v1/me/player/recently-played?limit=5", {
          headers: {
            authorization: `Bearer ${accessToken}`
          }
        });
      }

      if (!response.ok) {
        const text = await response.text();
        throw new Response(`Spotify recently-played request failed (${response.status}): ${text || "empty response"}`, {
          status: response.status
        });
      }

      const payload = (await response.json()) as {
        items?: Array<{
          played_at?: string;
          track?: {
            id?: string;
            name?: string;
            artists?: { name?: string }[];
            album?: { name?: string };
            uri?: string;
            duration_ms?: number;
          };
        }>;
      };

      return {
        items: (payload.items ?? []).map((item) => ({
          id: item.track?.id ?? "",
          trackName: item.track?.name ?? "",
          artistName: item.track?.artists?.[0]?.name ?? "",
          albumName: item.track?.album?.name ?? "",
          uri: item.track?.uri ?? "",
          durationMs: item.track?.duration_ms ?? 0,
          playedAt: item.played_at ?? ""
        }))
      };
    },
    async getFeaturedPlaylists(userId: string) {
      if (!isConfigured()) {
        throw new Response("Spotify is not configured", { status: 503 });
      }

      const { response } = await fetchSpotifyWithRetry(
        userId,
        "https://api.spotify.com/v1/browse/featured-playlists?limit=8"
      );

      if (!response.ok) {
        const text = await response.text();
        throw new Response(`Spotify featured-playlists request failed (${response.status}): ${text || "empty response"}`, {
          status: response.status
        });
      }

      const payload = (await response.json()) as {
        playlists?: {
          items?: Array<{
            id?: string;
            name?: string;
            description?: string | null;
            images?: Array<{ url?: string }>;
            owner?: { display_name?: string | null };
            tracks?: { total?: number };
            uri?: string;
          }>;
        };
      };

      return {
        items: (payload.playlists?.items ?? []).map((item) => summarizePlaylist(item))
      };
    },
    async getPlaylists(userId: string) {
      if (!isConfigured()) {
        throw new Response("Spotify is not configured", { status: 503 });
      }

      const { response } = await fetchSpotifyWithRetry(userId, "https://api.spotify.com/v1/me/playlists?limit=20");

      if (!response.ok) {
        const text = await response.text();
        throw new Response(`Spotify playlists request failed (${response.status}): ${text || "empty response"}`, {
          status: response.status
        });
      }

      const payload = (await response.json()) as {
        items?: Array<{
          id?: string;
          name?: string;
          description?: string | null;
          images?: Array<{ url?: string }>;
          owner?: { display_name?: string | null };
          tracks?: { total?: number };
          uri?: string;
        }>;
      };

      return {
        items: (payload.items ?? []).map((item) => summarizePlaylist(item))
      };
    },
    async getSavedTracks(userId: string) {
      if (!isConfigured()) {
        throw new Response("Spotify is not configured", { status: 503 });
      }

      const { response } = await fetchSpotifyWithRetry(userId, "https://api.spotify.com/v1/me/tracks?limit=20");

      if (!response.ok) {
        const text = await response.text();
        throw new Response(`Spotify saved-tracks request failed (${response.status}): ${text || "empty response"}`, {
          status: response.status
        });
      }

      const payload = (await response.json()) as {
        items?: Array<{
          track?: {
            id?: string;
            name?: string;
            artists?: Array<{ name?: string }>;
            album?: { name?: string };
            uri?: string;
            duration_ms?: number;
          };
        }>;
      };

      return {
        items: (payload.items ?? []).map((item) => summarizeTrack(item.track ?? {}))
      };
    },
    async getPlaylist(userId: string, playlistId: string) {
      if (!isConfigured()) {
        throw new Response("Spotify is not configured", { status: 503 });
      }

      const { response } = await fetchSpotifyWithRetry(
        userId,
        `https://api.spotify.com/v1/playlists/${playlistId}?fields=id,name,description,images,owner(display_name),tracks(total,items(track(id,name,artists(name),album(name),uri,duration_ms))),uri`
      );

      if (!response.ok) {
        const text = await response.text();
        throw new Response(`Spotify playlist request failed (${response.status}): ${text || "empty response"}`, {
          status: response.status
        });
      }

      const payload = (await response.json()) as {
        id?: string;
        name?: string;
        description?: string | null;
        images?: Array<{ url?: string }>;
        owner?: { display_name?: string | null };
        tracks?: {
          total?: number;
          items?: Array<{
            track?: {
              id?: string;
              name?: string;
              artists?: Array<{ name?: string }>;
              album?: { name?: string };
              uri?: string;
              duration_ms?: number;
            };
          }>;
        };
        uri?: string;
      };

      return {
        ...summarizePlaylist(payload),
        tracks: (payload.tracks?.items ?? []).map((item) => summarizeTrack(item.track ?? {}))
      };
    },
    async search(userId: string, query: string) {
      if (!isConfigured()) {
        throw new Response("Spotify is not configured", { status: 503 });
      }

      const url = new URL("https://api.spotify.com/v1/search");
      url.searchParams.set("q", query);
      url.searchParams.set("type", "track,playlist,album,artist");
      url.searchParams.set("limit", "5");

      const { response } = await fetchSpotifyWithRetry(userId, url.toString());

      if (!response.ok) {
        const text = await response.text();
        throw new Response(`Spotify search request failed (${response.status}): ${text || "empty response"}`, {
          status: response.status
        });
      }

      const payload = (await response.json()) as {
        tracks?: { items?: Array<Parameters<typeof summarizeTrack>[0]> };
        playlists?: { items?: Array<Parameters<typeof summarizePlaylist>[0]> };
        albums?: { items?: Array<Parameters<typeof summarizeAlbum>[0]> };
        artists?: { items?: Array<Parameters<typeof summarizeArtist>[0]> };
      };

      return {
        tracks: (payload.tracks?.items ?? []).map((item) => summarizeTrack(item)),
        playlists: (payload.playlists?.items ?? []).map((item) => summarizePlaylist(item)),
        albums: (payload.albums?.items ?? []).map((item) => summarizeAlbum(item)),
        artists: (payload.artists?.items ?? []).map((item) => summarizeArtist(item))
      };
    },
    async play(userId: string) {
      return runPlayerAction(userId, "play");
    },
    async pause(userId: string) {
      return runPlayerAction(userId, "pause");
    },
    async next(userId: string) {
      return runPlayerAction(userId, "next");
    },
    async previous(userId: string) {
      return runPlayerAction(userId, "previous");
    },
    async playTrack(userId: string, uri: string) {
      return runPlayPayloadAction(userId, "play-track", {
        uris: [uri]
      });
    },
    async playContext(userId: string, contextUri: string) {
      return runPlayPayloadAction(userId, "play-context", {
        context_uri: contextUri
      });
    },
    async transferPlayback(userId: string, deviceId: string) {
      if (!isConfigured()) {
        throw new Response("Spotify is not configured", { status: 503 });
      }

      if (!deviceId) {
        throw new Response("Device id is required", { status: 400 });
      }

      const { response } = await fetchSpotifyWithRetry(userId, "https://api.spotify.com/v1/me/player", {
        method: "PUT",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          device_ids: [deviceId],
          play: false
        })
      });

      if (!response.ok) {
        const failure = parsePlayerFailure(await readSpotifyError(response));
        throw new Response(failure.message, { status: failure.status });
      }

      return {
        ok: true,
        action: "transfer"
      };
    },
    async setShuffle(userId: string, enabled: boolean) {
      return runPlayerSettingAction(userId, "shuffle", {
        state: enabled ? "true" : "false"
      });
    },
    async setRepeatMode(userId: string, mode: SpotifyRepeatMode) {
      return runPlayerSettingAction(userId, "repeat", {
        state: mode
      });
    },
    async setVolume(userId: string, volumePercent: number) {
      return runPlayerSettingAction(userId, "volume", {
        volume_percent: String(clampVolume(volumePercent))
      });
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
