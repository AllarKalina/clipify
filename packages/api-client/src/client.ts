import { z } from "zod";
import type {
  CliBootstrapResponse,
  CliDevicesResponse,
  CliHomeViewResponse,
  CliLibraryViewResponse,
  CliPlayerActionRequest,
  CliPlayerActionResponse,
  CliSearchResponse,
  PublicExampleResponse,
  PublicVersionResponse,
  SpotifyAlbumSummary,
  SpotifyAuthStatusResponse,
  SpotifyCallbackResponse,
  SpotifyDeviceSummary,
  SpotifyDevicesResponse,
  SpotifyPlayerActionResponse,
  SpotifyCurrentlyPlayingResponse,
  SpotifyFeaturedPlaylistsResponse,
  SpotifyPlaylistDetailResponse,
  SpotifyPlaylistsResponse,
  SpotifyProfileResponse,
  SpotifySavedTracksResponse,
  SpotifySearchResponse,
  SpotifyQueueResponse,
  SpotifyRepeatMode,
  SpotifyRecentlyPlayedResponse,
  SpotifyStartAuthResponse
} from "@clipify/contracts";

const versionSchema = z.object({
  appName: z.string(),
  apiVersion: z.string(),
  minCliVersion: z.string(),
  latestCliVersion: z.string()
});

const publicExampleSchema = z.object({
  id: z.string(),
  title: z.string(),
  category: z.string()
});

const meSchema = z.object({
  user: z.object({
    id: z.string(),
    email: z.string(),
    name: z.string()
  })
});

const spotifyStartAuthSchema = z.object({
  authorizeUrl: z.string().url(),
  state: z.string()
});

const spotifyCallbackSchema = z.object({
  linked: z.boolean(),
  userId: z.string()
});

const spotifyAuthStatusSchema = z.object({
  linked: z.boolean(),
  relinkRequired: z.boolean()
});

const spotifyCurrentlyPlayingSchema = z.object({
  playbackState: z.enum(["playing", "paused", "idle"]),
  isPlaying: z.boolean(),
  trackName: z.string(),
  artistName: z.string(),
  albumName: z.string(),
  albumImageUrl: z.string(),
  deviceId: z.string(),
  deviceName: z.string(),
  deviceType: z.string(),
  deviceStatus: z.enum(["active", "available", "restricted", "none"]),
  supportsVolume: z.boolean(),
  volumePercent: z.number(),
  shuffleEnabled: z.boolean(),
  repeatMode: z.enum(["off", "track", "context"]),
  progressMs: z.number(),
  durationMs: z.number()
});

const spotifyQueueSchema = z.object({
  items: z.array(
    z.object({
      trackName: z.string(),
      artistName: z.string(),
      albumName: z.string(),
      type: z.enum(["track", "episode", "unknown"])
    })
  )
});

const spotifyDeviceSummarySchema: z.ZodType<SpotifyDeviceSummary> = z.object({
  id: z.string(),
  name: z.string(),
  type: z.string(),
  isActive: z.boolean(),
  isRestricted: z.boolean(),
  supportsVolume: z.boolean(),
  volumePercent: z.number()
});

const spotifyDevicesSchema = z.object({
  items: z.array(spotifyDeviceSummarySchema)
});

const spotifyTrackSummarySchema = z.object({
  id: z.string(),
  trackName: z.string(),
  artistName: z.string(),
  albumName: z.string(),
  uri: z.string(),
  durationMs: z.number()
});

const spotifyPlaylistSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  imageUrl: z.string(),
  ownerName: z.string(),
  isPinned: z.boolean().optional(),
  trackCount: z.number(),
  uri: z.string()
});

const spotifyAlbumSummarySchema: z.ZodType<SpotifyAlbumSummary> = z.object({
  id: z.string(),
  name: z.string(),
  artistName: z.string(),
  imageUrl: z.string(),
  uri: z.string()
});

const spotifyArtistSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  imageUrl: z.string(),
  uri: z.string()
});

const spotifyPlaylistsSchema = z.object({
  items: z.array(spotifyPlaylistSummarySchema)
});

const spotifySavedTracksSchema = z.object({
  items: z.array(spotifyTrackSummarySchema)
});

const spotifyPlaylistDetailSchema = spotifyPlaylistSummarySchema.extend({
  tracks: z.array(spotifyTrackSummarySchema)
});

const spotifyFeaturedPlaylistsSchema = z.object({
  items: z.array(spotifyPlaylistSummarySchema)
});

const spotifySearchSchema = z.object({
  tracks: z.array(spotifyTrackSummarySchema),
  playlists: z.array(spotifyPlaylistSummarySchema),
  albums: z.array(spotifyAlbumSummarySchema),
  artists: z.array(spotifyArtistSummarySchema)
});

const spotifyRecentlyPlayedSchema = z.object({
  items: z.array(
    z.object({
      id: z.string(),
      trackName: z.string(),
      artistName: z.string(),
      albumName: z.string(),
      uri: z.string(),
      durationMs: z.number(),
      playedAt: z.string()
    })
  )
});

const spotifyProfileSchema = z.object({
  id: z.string(),
  displayName: z.string(),
  email: z.string(),
  profileUrl: z.string(),
  imageUrl: z.string()
});

const spotifyPlayerActionSchema = z.object({
  ok: z.literal(true),
  action: z.enum(["play", "pause", "next", "previous", "shuffle", "repeat", "volume", "transfer", "play-track", "play-context"])
});

const cliBootstrapSchema = z.object({
  home: z.object({
    spotify: z.enum(["linked", "not-linked", "relink-required"]),
    userName: z.string(),
    userEmail: z.string(),
    spotifyDisplayName: z.string(),
    deviceId: z.string(),
    deviceName: z.string(),
    deviceType: z.string(),
    deviceStatus: z.enum(["active", "available", "restricted", "none"]),
    supportsVolume: z.boolean(),
    volumePercent: z.number(),
    playbackState: z.enum(["playing", "paused", "idle"]),
    shuffleEnabled: z.boolean(),
    repeatMode: z.enum(["off", "track", "context"]),
    trackName: z.string(),
    artistName: z.string(),
    albumName: z.string(),
    progressMs: z.number(),
    durationMs: z.number(),
    queueStatus: z.enum(["ready", "no-device", "relink-required", "unavailable"]),
    queue: spotifyQueueSchema.shape.items,
    recentUnavailable: z.boolean(),
    recent: spotifyRecentlyPlayedSchema.shape.items,
    linked: z.boolean(),
    relinkRequired: z.boolean(),
    profile: spotifyProfileSchema.nullable()
  }),
  browse: z.object({
    featuredPlaylists: spotifyFeaturedPlaylistsSchema.shape.items,
    playlists: spotifyPlaylistsSchema.shape.items,
    likedTracks: spotifySavedTracksSchema.shape.items
  }),
  warning: z.string()
});

const cliHomeViewSectionSchema = z.object({
  id: z.enum(["quick-launch", "picked"]),
  title: z.string(),
  items: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      subtitle: z.string(),
      meta: z.string(),
      action: z.union([
        z.object({
          type: z.literal("play-context"),
          uri: z.string()
        }),
        z.object({
          type: z.literal("open-playlist"),
          playlistId: z.string()
        })
      ])
    })
  )
});

const cliHomeViewSchema = z.object({
  sections: z.array(cliHomeViewSectionSchema)
});

const cliLibraryViewSchema = z.object({
  section: z
    .object({
      id: z.string(),
      title: z.string(),
      items: z.array(
        z.object({
          id: z.string(),
          title: z.string(),
          subtitle: z.string(),
          meta: z.string().optional(),
          action: z.object({
            type: z.literal("play-track"),
            uri: z.string()
          })
        })
      )
    })
    .nullable()
});

const cliPlayerActionRequestSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("play") }),
  z.object({ action: z.literal("pause") }),
  z.object({ action: z.literal("next") }),
  z.object({ action: z.literal("previous") }),
  z.object({ action: z.literal("shuffle"), enabled: z.boolean() }),
  z.object({ action: z.literal("repeat"), mode: z.enum(["off", "track", "context"]) }),
  z.object({ action: z.literal("volume"), volumePercent: z.number() }),
  z.object({ action: z.literal("transfer"), deviceId: z.string() }),
  z.object({ action: z.literal("play-track"), uri: z.string() }),
  z.object({ action: z.literal("play-context"), contextUri: z.string() })
]);

export class ApiClientError extends Error {
  readonly status: number;
  readonly path: string;

  constructor(message: string, status: number, path: string) {
    super(message);
    this.name = "ApiClientError";
    this.status = status;
    this.path = path;
  }
}

export type ApiClient = {
  getVersion: () => Promise<PublicVersionResponse>;
  getPublicExample: () => Promise<PublicExampleResponse>;
  getMe: () => Promise<{ user: { id: string; email: string; name: string } }>;
  signUpWithEmailPassword: (input: {
    name: string;
    email: string;
    password: string;
  }) => Promise<{ sessionCookie: string }>;
  signInWithEmailPassword: (input: {
    email: string;
    password: string;
    rememberMe?: boolean;
  }) => Promise<{ sessionCookie: string }>;
  signOut: () => Promise<void>;
  startSpotifyAuthorization: () => Promise<SpotifyStartAuthResponse>;
  completeSpotifyAuthorization: (input: { code: string; state: string }) => Promise<SpotifyCallbackResponse>;
  getSpotifyAuthorizationStatus: () => Promise<SpotifyAuthStatusResponse>;
  getSpotifyProfile: () => Promise<SpotifyProfileResponse>;
  getSpotifyFeaturedPlaylists: () => Promise<SpotifyFeaturedPlaylistsResponse>;
  getSpotifyPlaylists: () => Promise<SpotifyPlaylistsResponse>;
  getSpotifySavedTracks: () => Promise<SpotifySavedTracksResponse>;
  getSpotifyPlaylist: (playlistId: string) => Promise<SpotifyPlaylistDetailResponse>;
  searchSpotify: (query: string) => Promise<SpotifySearchResponse>;
  getSpotifyCurrentlyPlaying: () => Promise<SpotifyCurrentlyPlayingResponse>;
  getSpotifyDevices: () => Promise<SpotifyDevicesResponse>;
  getSpotifyQueue: () => Promise<SpotifyQueueResponse>;
  getSpotifyRecentlyPlayed: () => Promise<SpotifyRecentlyPlayedResponse>;
  playSpotify: () => Promise<SpotifyPlayerActionResponse>;
  pauseSpotify: () => Promise<SpotifyPlayerActionResponse>;
  nextSpotify: () => Promise<SpotifyPlayerActionResponse>;
  previousSpotify: () => Promise<SpotifyPlayerActionResponse>;
  playSpotifyTrack: (uri: string) => Promise<SpotifyPlayerActionResponse>;
  playSpotifyContext: (contextUri: string) => Promise<SpotifyPlayerActionResponse>;
  setSpotifyShuffle: (enabled: boolean) => Promise<SpotifyPlayerActionResponse>;
  setSpotifyRepeatMode: (mode: SpotifyRepeatMode) => Promise<SpotifyPlayerActionResponse>;
  setSpotifyVolume: (volumePercent: number) => Promise<SpotifyPlayerActionResponse>;
  transferSpotifyPlayback: (deviceId: string) => Promise<SpotifyPlayerActionResponse>;
  getCliBootstrap?: () => Promise<CliBootstrapResponse>;
  getCliHomeView?: () => Promise<CliHomeViewResponse>;
  getCliLibraryView?: (libraryId: string) => Promise<CliLibraryViewResponse>;
  searchCli?: (query: string) => Promise<CliSearchResponse>;
  getCliDevices?: () => Promise<CliDevicesResponse>;
  runCliPlayerAction?: (request: CliPlayerActionRequest) => Promise<CliPlayerActionResponse>;
};

type FetchLike = (input: URL | Request | string, init?: RequestInit) => Promise<Response>;

type ClientDeps = {
  baseUrl: string;
  fetchImpl?: FetchLike;
  sessionCookie?: string;
};

type RequestOptions<T> = {
  schema: z.ZodType<T>;
  query?: Record<string, string>;
  requireSession?: boolean;
};

export function createApiClient({ baseUrl, fetchImpl = fetch, sessionCookie }: ClientDeps): ApiClient {
  const authOrigin = new URL(baseUrl).origin;

  function parseSessionCookie(setCookie: string, path: string): { sessionCookie: string } {
    const match = setCookie.match(/(?:^|,\s*)better-auth\.session_token=([^;,\s]+)/);

    if (!match?.[1]) {
      throw new ApiClientError("Auth succeeded but session cookie was missing in response", 502, path);
    }

    return {
      sessionCookie: `better-auth.session_token=${match[1]}`
    };
  }

  async function request<T>(path: string, options: RequestOptions<T>): Promise<T> {
    const url = new URL(path, baseUrl);
    if (options.query) {
      for (const [key, value] of Object.entries(options.query)) {
        url.searchParams.set(key, value);
      }
    }

    const headers = new Headers({
      accept: "application/json"
    });

    if (options.requireSession) {
      if (!sessionCookie) {
        throw new ApiClientError(`Missing session cookie for ${path}`, 401, path);
      }
      headers.set("cookie", sessionCookie);
    }

    const response = await fetchImpl(url, {
      method: "GET",
      headers
    });

    if (!response.ok) {
      const text = await response.text();
      throw new ApiClientError(`Request failed for ${path}: ${response.status} ${text}`, response.status, path);
    }

    const body = await response.json();
    const parsed = options.schema.safeParse(body);

    if (!parsed.success) {
      throw new ApiClientError(`Invalid response for ${path}`, 502, path);
    }

    return parsed.data;
  }

  async function post<T>(path: string, schema: z.ZodType<T>, requireSession = true, body?: unknown): Promise<T> {
    const url = new URL(path, baseUrl);
    const headers = new Headers({
      accept: "application/json"
    });

    if (requireSession) {
      if (!sessionCookie) {
        throw new ApiClientError(`Missing session cookie for ${path}`, 401, path);
      }
      headers.set("cookie", sessionCookie);
    }

    if (body !== undefined) {
      headers.set("content-type", "application/json");
    }

    const response = await fetchImpl(url, {
      method: "POST",
      headers,
      body: body === undefined ? undefined : JSON.stringify(body)
    });

    if (!response.ok) {
      const text = await response.text();
      throw new ApiClientError(`Request failed for ${path}: ${response.status} ${text}`, response.status, path);
    }

    const responseBody = await response.json();
    const parsed = schema.safeParse(responseBody);
    if (!parsed.success) {
      throw new ApiClientError(`Invalid response for ${path}`, 502, path);
    }

    return parsed.data;
  }

  async function postWithQuery<T>(
    path: string,
    schema: z.ZodType<T>,
    query?: Record<string, string>,
    requireSession = true
  ): Promise<T> {
    const url = new URL(path, baseUrl);
    if (query) {
      for (const [key, value] of Object.entries(query)) {
        url.searchParams.set(key, value);
      }
    }

    const headers = new Headers({
      accept: "application/json"
    });

    if (requireSession) {
      if (!sessionCookie) {
        throw new ApiClientError(`Missing session cookie for ${path}`, 401, path);
      }
      headers.set("cookie", sessionCookie);
    }

    const response = await fetchImpl(url, {
      method: "POST",
      headers
    });

    if (!response.ok) {
      const text = await response.text();
      throw new ApiClientError(`Request failed for ${path}: ${response.status} ${text}`, response.status, path);
    }

    const body = await response.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      throw new ApiClientError(`Invalid response for ${path}`, 502, path);
    }

    return parsed.data;
  }

  async function put<T>(path: string, schema: z.ZodType<T>, query?: Record<string, string>, requireSession = true): Promise<T> {
    const url = new URL(path, baseUrl);
    if (query) {
      for (const [key, value] of Object.entries(query)) {
        url.searchParams.set(key, value);
      }
    }

    const headers = new Headers({
      accept: "application/json"
    });

    if (requireSession) {
      if (!sessionCookie) {
        throw new ApiClientError(`Missing session cookie for ${path}`, 401, path);
      }
      headers.set("cookie", sessionCookie);
    }

    const response = await fetchImpl(url, {
      method: "PUT",
      headers
    });

    if (!response.ok) {
      const text = await response.text();
      throw new ApiClientError(`Request failed for ${path}: ${response.status} ${text}`, response.status, path);
    }

    const body = await response.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      throw new ApiClientError(`Invalid response for ${path}`, 502, path);
    }

    return parsed.data;
  }

  async function signInWithEmailPassword(input: {
    email: string;
    password: string;
    rememberMe?: boolean;
  }): Promise<{ sessionCookie: string }> {
    const url = new URL("/api/auth/sign-in/email", baseUrl);
    const response = await fetchImpl(url, {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        origin: authOrigin
      },
      body: JSON.stringify({
        email: input.email,
        password: input.password,
        rememberMe: input.rememberMe ?? true
      })
    });

    if (!response.ok) {
      const text = await response.text();
      throw new ApiClientError(`Request failed for /api/auth/sign-in/email: ${response.status} ${text}`, response.status, "/api/auth/sign-in/email");
    }

    return parseSessionCookie(response.headers.get("set-cookie") ?? "", "/api/auth/sign-in/email");
  }

  async function signUpWithEmailPassword(input: { name: string; email: string; password: string }): Promise<{
    sessionCookie: string;
  }> {
    const url = new URL("/api/auth/sign-up/email", baseUrl);
    const response = await fetchImpl(url, {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        origin: authOrigin
      },
      body: JSON.stringify({
        name: input.name,
        email: input.email,
        password: input.password
      })
    });

    if (!response.ok) {
      const text = await response.text();
      throw new ApiClientError(
        `Request failed for /api/auth/sign-up/email: ${response.status} ${text}`,
        response.status,
        "/api/auth/sign-up/email"
      );
    }

    return parseSessionCookie(response.headers.get("set-cookie") ?? "", "/api/auth/sign-up/email");
  }

  async function signOut(): Promise<void> {
    if (!sessionCookie) {
      throw new ApiClientError("Missing session cookie for /api/auth/sign-out", 401, "/api/auth/sign-out");
    }

    const url = new URL("/api/auth/sign-out", baseUrl);
    const response = await fetchImpl(url, {
      method: "POST",
      headers: {
        accept: "application/json",
        cookie: sessionCookie,
        origin: authOrigin
      }
    });

    if (!response.ok) {
      const text = await response.text();
      throw new ApiClientError(`Request failed for /api/auth/sign-out: ${response.status} ${text}`, response.status, "/api/auth/sign-out");
    }
  }

  return {
    getVersion() {
      return request("/v1/public/meta/version", { schema: versionSchema });
    },
    getPublicExample() {
      return request("/v1/public/example", { schema: publicExampleSchema });
    },
    getMe() {
      return request("/v1/me", {
        schema: meSchema,
        requireSession: true
      });
    },
    signUpWithEmailPassword,
    signInWithEmailPassword,
    signOut,
    startSpotifyAuthorization() {
      return request("/v1/spotify/auth/start", {
        schema: spotifyStartAuthSchema,
        requireSession: true
      });
    },
    completeSpotifyAuthorization(input) {
      return request("/v1/spotify/auth/callback", {
        schema: spotifyCallbackSchema,
        query: {
          code: input.code,
          state: input.state
        },
        requireSession: true
      });
    },
    getSpotifyAuthorizationStatus() {
      return request("/v1/spotify/auth/status", {
        schema: spotifyAuthStatusSchema,
        requireSession: true
      });
    },
    getSpotifyProfile() {
      return request("/v1/spotify/me", {
        schema: spotifyProfileSchema,
        requireSession: true
      });
    },
    getSpotifyFeaturedPlaylists() {
      return request("/v1/spotify/browse/featured-playlists", {
        schema: spotifyFeaturedPlaylistsSchema,
        requireSession: true
      });
    },
    getSpotifyPlaylists() {
      return request("/v1/spotify/me/playlists", {
        schema: spotifyPlaylistsSchema,
        requireSession: true
      });
    },
    getSpotifySavedTracks() {
      return request("/v1/spotify/me/tracks", {
        schema: spotifySavedTracksSchema,
        requireSession: true
      });
    },
    getSpotifyPlaylist(playlistId) {
      return request(`/v1/spotify/playlists/${playlistId}`, {
        schema: spotifyPlaylistDetailSchema,
        requireSession: true
      });
    },
    searchSpotify(query) {
      return request("/v1/spotify/search", {
        schema: spotifySearchSchema,
        query: { q: query },
        requireSession: true
      });
    },
    getSpotifyCurrentlyPlaying() {
      return request("/v1/spotify/me/player/currently-playing", {
        schema: spotifyCurrentlyPlayingSchema,
        requireSession: true
      });
    },
    getSpotifyDevices() {
      return request("/v1/spotify/me/player/devices", {
        schema: spotifyDevicesSchema,
        requireSession: true
      });
    },
    getSpotifyQueue() {
      return request("/v1/spotify/me/player/queue", {
        schema: spotifyQueueSchema,
        requireSession: true
      });
    },
    getSpotifyRecentlyPlayed() {
      return request("/v1/spotify/me/player/recently-played", {
        schema: spotifyRecentlyPlayedSchema,
        requireSession: true
      });
    },
    playSpotify() {
      return post("/v1/spotify/me/player/play", spotifyPlayerActionSchema);
    },
    pauseSpotify() {
      return post("/v1/spotify/me/player/pause", spotifyPlayerActionSchema);
    },
    nextSpotify() {
      return post("/v1/spotify/me/player/next", spotifyPlayerActionSchema);
    },
    previousSpotify() {
      return post("/v1/spotify/me/player/previous", spotifyPlayerActionSchema);
    },
    playSpotifyTrack(uri) {
      return postWithQuery("/v1/spotify/me/player/play-track", spotifyPlayerActionSchema, { uri });
    },
    playSpotifyContext(contextUri) {
      return postWithQuery("/v1/spotify/me/player/play-context", spotifyPlayerActionSchema, { contextUri });
    },
    setSpotifyShuffle(enabled) {
      return put("/v1/spotify/me/player/shuffle", spotifyPlayerActionSchema, {
        state: enabled ? "true" : "false"
      });
    },
    setSpotifyRepeatMode(mode) {
      return put("/v1/spotify/me/player/repeat", spotifyPlayerActionSchema, {
        state: mode
      });
    },
    setSpotifyVolume(volumePercent) {
      return put("/v1/spotify/me/player/volume", spotifyPlayerActionSchema, {
        volumePercent: String(volumePercent)
      });
    },
    transferSpotifyPlayback(deviceId) {
      return put("/v1/spotify/me/player/transfer", spotifyPlayerActionSchema, {
        deviceId
      });
    },
    getCliBootstrap() {
      return request("/v1/cli/bootstrap", {
        schema: cliBootstrapSchema,
        requireSession: true
      });
    },
    getCliHomeView() {
      return request("/v1/cli/view/home", {
        schema: cliHomeViewSchema,
        requireSession: true
      });
    },
    getCliLibraryView(libraryId) {
      return request(`/v1/cli/view/library/${libraryId}`, {
        schema: cliLibraryViewSchema,
        requireSession: true
      });
    },
    searchCli(query) {
      return request("/v1/cli/search", {
        schema: spotifySearchSchema,
        query: { q: query },
        requireSession: true
      });
    },
    getCliDevices() {
      return request("/v1/cli/devices", {
        schema: spotifyDevicesSchema,
        requireSession: true
      });
    },
    runCliPlayerAction(action) {
      const parsed = cliPlayerActionRequestSchema.safeParse(action);
      if (!parsed.success) {
        throw new ApiClientError("Invalid CLI player action input", 400, "/v1/cli/player/action");
      }

      return post("/v1/cli/player/action", spotifyPlayerActionSchema, true, parsed.data);
    }
  };
}
