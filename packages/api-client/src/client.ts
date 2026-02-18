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

const spotifyStartAuthSchema = z.object({
  authorizeUrl: z.string().url(),
  state: z.string()
});

const spotifyCallbackSchema = z.object({
  linked: z.boolean(),
  userId: z.string()
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
  startSpotifyAuthorization: () => Promise<SpotifyStartAuthResponse>;
  completeSpotifyAuthorization: (input: { code: string; state: string }) => Promise<SpotifyCallbackResponse>;
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

  return {
    getVersion() {
      return request("/v1/public/meta/version", { schema: versionSchema });
    },
    getPublicExample() {
      return request("/v1/public/example", { schema: publicExampleSchema });
    },
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
    getSpotifyCurrentlyPlaying() {
      return request("/v1/spotify/me/player/currently-playing", {
        schema: spotifyCurrentlyPlayingSchema,
        requireSession: true
      });
    }
  };
}
