import { z } from "zod";
import type { PublicExampleResponse, PublicVersionResponse } from "../../../apps/api/src/modules/public/contracts";
import type {
  SpotifyAuthStatusResponse,
  SpotifyCallbackResponse,
  SpotifyCurrentlyPlayingResponse,
  SpotifyProfileResponse,
  SpotifyRecentlyPlayedResponse,
  SpotifyStartAuthResponse
} from "../../../apps/api/src/modules/spotify/contracts";

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
  linked: z.boolean()
});

const spotifyCurrentlyPlayingSchema = z.object({
  playbackState: z.enum(["playing", "paused", "idle"]),
  isPlaying: z.boolean(),
  trackName: z.string(),
  artistName: z.string(),
  albumName: z.string(),
  albumImageUrl: z.string(),
  deviceName: z.string(),
  deviceType: z.string(),
  progressMs: z.number(),
  durationMs: z.number()
});

const spotifyRecentlyPlayedSchema = z.object({
  items: z.array(
    z.object({
      trackName: z.string(),
      artistName: z.string(),
      albumName: z.string(),
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
  getSpotifyCurrentlyPlaying: () => Promise<SpotifyCurrentlyPlayingResponse>;
  getSpotifyRecentlyPlayed: () => Promise<SpotifyRecentlyPlayedResponse>;
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
    getSpotifyCurrentlyPlaying() {
      return request("/v1/spotify/me/player/currently-playing", {
        schema: spotifyCurrentlyPlayingSchema,
        requireSession: true
      });
    },
    getSpotifyRecentlyPlayed() {
      return request("/v1/spotify/me/player/recently-played", {
        schema: spotifyRecentlyPlayedSchema,
        requireSession: true
      });
    }
  };
}
