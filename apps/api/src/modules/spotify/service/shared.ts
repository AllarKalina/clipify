import type { AppEnv } from "../../../config/env";
import type { AppDb } from "../../../db/client";
import type {
  SpotifyAlbumSummary,
  SpotifyArtistSummary,
  SpotifyDeviceStatus,
  SpotifyDeviceSummary,
  SpotifyPlaylistSummary,
  SpotifyProfileResponse,
  SpotifyRepeatMode,
  SpotifyTrackSummary
} from "../contracts";

export type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

export type SpotifyConnection = {
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

export type SpotifyOAuthState = {
  id: string;
  userId: string;
  stateHash: string;
  expiresAt: Date;
  createdAt: Date;
};

export type SpotifyConnectionStore = {
  findByUserId: (userId: string) => Promise<SpotifyConnection | null>;
  findBySpotifyUserId: (spotifyUserId: string) => Promise<SpotifyConnection | null>;
  upsertConnection: (connection: SpotifyConnection) => Promise<void>;
  createOauthState: (oauthState: SpotifyOAuthState) => Promise<void>;
  consumeOauthState: (stateHash: string, now: Date) => Promise<SpotifyOAuthState | null>;
};

export type SpotifyServiceDeps = {
  store?: SpotifyConnectionStore;
  db?: AppDb;
  fetchImpl?: FetchLike;
  now?: () => Date;
  randomUUID?: () => string;
};

export type SpotifyTokenResponse = {
  access_token: string;
  token_type: string;
  scope?: string;
  expires_in?: number;
  refresh_token?: string;
};

export const requiredScopes = [
  "user-read-private",
  "user-read-email",
  "user-read-playback-state",
  "user-read-recently-played",
  "user-modify-playback-state",
  "playlist-read-private",
  "playlist-read-collaborative",
  "user-library-read"
] as const;

export const REQUIRED_SCOPE = requiredScopes.join(" ");

export type SpotifyApiCallResult = {
  connection: SpotifyConnection;
  accessToken: string;
  response: Response;
};

export type SpotifyDevicePayload = {
  id?: string;
  is_active?: boolean;
  is_restricted?: boolean;
  name?: string;
  supports_volume?: boolean;
  type?: string;
  volume_percent?: number | null;
};

export type SpotifyPlaylistTrackEntry = {
  added_at?: string | null;
  item?: {
    id?: string;
    name?: string;
    artists?: Array<{ name?: string }>;
    album?: { name?: string };
    uri?: string;
    duration_ms?: number;
    type?: string;
  } | null;
};

export type SpotifyPlaylistTrackPayload = SpotifyPlaylistTrackEntry | null;
export type SpotifyPlayableTrackPayload = NonNullable<SpotifyPlaylistTrackEntry["item"]>;

export type SpotifyPlaylistItemsPagePayload = {
  items?: SpotifyPlaylistTrackPayload[];
  next?: string | null;
};

export type SpotifyServiceContext = {
  env: AppEnv;
  store: SpotifyConnectionStore;
  fetchImpl: FetchLike;
  now: () => Date;
  randomUUID: () => string;
  isConfigured: () => boolean;
  requireConfigured: () => void;
  fetchSpotifyWithRetry: (userId: string, input: string, init?: RequestInit) => Promise<SpotifyApiCallResult>;
  ensureConnection: (userId: string) => Promise<SpotifyConnection>;
  refreshAccessToken: (connection: SpotifyConnection) => Promise<SpotifyConnection>;
  exchangeCodeForToken: (code: string) => Promise<SpotifyTokenResponse>;
  fetchSpotifyProfile: (accessToken: string) => Promise<SpotifyProfileResponse>;
  completeAuthorizationForUser: (userId: string, code: string) => Promise<{ linked: boolean; userId: string }>;
};

export function isExpired(expiresAt: Date | null, now: Date): boolean {
  if (!expiresAt) {
    return false;
  }

  return expiresAt.getTime() <= now.getTime() + 30_000;
}

export function toExpiresAt(expiresIn: number | undefined, now: Date): Date | null {
  if (!expiresIn || expiresIn <= 0) {
    return null;
  }

  return new Date(now.getTime() + expiresIn * 1000);
}

export async function parseTokenResponse(response: Response): Promise<SpotifyTokenResponse> {
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

export async function readSpotifyError(response: Response): Promise<string> {
  const text = await response.text();
  return text || "empty response";
}

export function clampVolume(volumePercent: number): number {
  return Math.max(0, Math.min(100, Math.round(volumePercent)));
}

function parseScopeSet(scope: string | null | undefined): Set<string> {
  return new Set((scope ?? "").split(/\s+/u).filter(Boolean));
}

export function isScopeFresh(scope: string | null | undefined): boolean {
  const granted = parseScopeSet(scope);
  return requiredScopes.every((requiredScope) => granted.has(requiredScope));
}

export function summarizeDevice(device: SpotifyDevicePayload): SpotifyDeviceSummary {
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

export function toDeviceStatus(device: SpotifyDeviceSummary | null): SpotifyDeviceStatus {
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

export function toRepeatMode(value: string | undefined): SpotifyRepeatMode {
  if (value === "track" || value === "context") {
    return value;
  }

  return "off";
}

export function summarizePlaylist(item: {
  id?: string;
  name?: string;
  description?: string | null;
  images?: Array<{ url?: string }>;
  owner?: { display_name?: string | null };
  items?: { total?: number };
  uri?: string;
}): SpotifyPlaylistSummary {
  return {
    id: item.id ?? "",
    name: item.name ?? "",
    description: item.description ?? "",
    imageUrl: item.images?.[0]?.url ?? "",
    ownerName: item.owner?.display_name ?? "",
    isPinned: undefined,
    trackCount: item.items?.total ?? 0,
    uri: item.uri ?? ""
  };
}

export function summarizeTrack(item: {
  id?: string;
  name?: string;
  artists?: Array<{ name?: string }>;
  album?: { name?: string };
  uri?: string;
  duration_ms?: number;
  added_at?: string | null;
}): SpotifyTrackSummary {
  return {
    id: item.id ?? "",
    trackName: item.name ?? "",
    artistName: item.artists?.[0]?.name ?? "",
    albumName: item.album?.name ?? "",
    uri: item.uri ?? "",
    durationMs: item.duration_ms ?? 0,
    ...(item.added_at ? { addedAt: item.added_at } : {})
  };
}

function isPlayableTrack(track: SpotifyPlaylistTrackEntry["item"]): track is SpotifyPlayableTrackPayload {
  if (!track) {
    return false;
  }

  return track.type === undefined || track.type === "track";
}

export function summarizePlaylistTracks(items: SpotifyPlaylistTrackPayload[] | undefined) {
  return (items ?? []).flatMap((entry) => {
    const track = entry?.item ?? null;
    if (!isPlayableTrack(track)) {
      return [];
    }

    return [summarizeTrack({ ...track, added_at: entry?.added_at ?? undefined })];
  });
}

export function buildPlaylistItemsUrl(playlistId: string, offset = 0) {
  const url = new URL(`https://api.spotify.com/v1/playlists/${playlistId}/items`);
  url.searchParams.set("limit", "50");
  url.searchParams.set("offset", String(offset));
  url.searchParams.set(
    "fields",
    "items(added_at,item(id,name,artists(name),album(name),uri,duration_ms,type)),next"
  );
  return url.toString();
}

export function summarizeAlbum(item: {
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

export function summarizeArtist(item: { id?: string; name?: string; images?: Array<{ url?: string }>; uri?: string }): SpotifyArtistSummary {
  return {
    id: item.id ?? "",
    name: item.name ?? "",
    imageUrl: item.images?.[0]?.url ?? "",
    uri: item.uri ?? ""
  };
}

export function parsePlayerFailure(text: string): { status: number; message: string } {
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
