import { z } from "zod";
import type { PublicExampleResponse, PublicVersionResponse } from "../../../apps/api/src/modules/public/contracts";
import type {
  SpotifyCallbackResponse,
  SpotifyCurrentlyPlayingResponse,
  SpotifyStartAuthResponse
} from "../../../apps/api/src/modules/spotify/service";

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
  isPlaying: z.boolean(),
  trackName: z.string(),
  artistName: z.string(),
  albumName: z.string()
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
  signInWithEmailPassword: (input: {
    email: string;
    password: string;
    rememberMe?: boolean;
  }) => Promise<{ sessionCookie: string }>;
  startSpotifyAuthorization: () => Promise<SpotifyStartAuthResponse>;
  completeSpotifyAuthorization: (input: { code: string; state: string }) => Promise<SpotifyCallbackResponse>;
  getSpotifyAuthorizationStatus: () => Promise<{ linked: boolean }>;
  getSpotifyCurrentlyPlaying: () => Promise<SpotifyCurrentlyPlayingResponse>;
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
        "content-type": "application/json"
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

    const setCookie = response.headers.get("set-cookie") ?? "";
    const match = setCookie.match(/(?:^|,\s*)better-auth\.session_token=([^;,\s]+)/);

    if (!match?.[1]) {
      throw new ApiClientError(
        "Sign-in succeeded but session cookie was missing in response",
        502,
        "/api/auth/sign-in/email"
      );
    }

    return {
      sessionCookie: `better-auth.session_token=${match[1]}`
    };
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
    signInWithEmailPassword,
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
    getSpotifyCurrentlyPlaying() {
      return request("/v1/spotify/me/player/currently-playing", {
        schema: spotifyCurrentlyPlayingSchema,
        requireSession: true
      });
    }
  };
}
