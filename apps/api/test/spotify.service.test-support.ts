import type { AppEnv } from "../src/config/env";
import { createSpotifyService, type SpotifyService } from "../src/modules/spotify/service";

export type StoreConnection = {
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

export type StoreOAuthState = {
  id: string;
  userId: string;
  stateHash: string;
  expiresAt: Date;
  createdAt: Date;
};

export type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

export function baseEnv(nodeEnv: AppEnv["NODE_ENV"] = "test"): AppEnv {
  return {
    API_VERSION: "v1",
    APP_NAME: "clipify-api",
    BETTER_AUTH_SECRET: "super-secret-value-123",
    BETTER_AUTH_URL: "http://localhost:3000",
    DATABASE_URL: "https://example.com/db",
    HOST: "127.0.0.1",
    LATEST_CLI_VERSION: "0.1.0",
    LOG_LEVEL: "error",
    MIN_CLI_VERSION: "0.1.0",
    NODE_ENV: nodeEnv,
    OTEL_ENABLED: false,
    OTEL_EXPORTER_OTLP_ENDPOINT: "https://otel.example.com/v1/traces",
    OTEL_EXPORTER_OTLP_HEADERS: "",
    OTEL_SERVICE_NAME: "clipify-api",
    PORT: 3000,
    SPOTIFY_CLIENT_ID: "spotify-client-id",
    SPOTIFY_CLIENT_SECRET: "spotify-client-secret",
    SPOTIFY_REDIRECT_URI: "http://127.0.0.1:3000/v1/cli/auth/callback/public",
    SPOTIFY_TOKEN_ENCRYPTION_KEY: "QUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUE="
  };
}

export const grantedScope =
  "user-read-private user-read-email user-read-playback-state user-read-recently-played user-modify-playback-state playlist-read-private playlist-read-collaborative user-library-read";

export function createMemoryStore(seedConnections: StoreConnection[] = [], seedStates: StoreOAuthState[] = []) {
  const connections = [...seedConnections];
  const oauthStates = [...seedStates];

  return {
    connections,
    oauthStates,
    async findByUserId(userId: string) {
      return connections.find((row) => row.userId === userId) ?? null;
    },
    async findBySpotifyUserId(spotifyUserId: string) {
      return connections.find((row) => row.spotifyUserId === spotifyUserId) ?? null;
    },
    async upsertConnection(connection: StoreConnection) {
      const index = connections.findIndex((row) => row.userId === connection.userId);
      if (index >= 0) {
        connections[index] = connection;
        return;
      }

      connections.push(connection);
    },
    async createOauthState(oauthState: StoreOAuthState) {
      oauthStates.push(oauthState);
    },
    async consumeOauthState(stateHash: string, now: Date) {
      const index = oauthStates.findIndex((row) => row.stateHash === stateHash && row.expiresAt.getTime() > now.getTime());

      if (index < 0) {
        return null;
      }

      const [consumed] = oauthStates.splice(index, 1);
      return consumed ?? null;
    }
  };
}

export async function createLinkedSpotifyService(options: {
  fetchImpl: FetchLike;
  store?: ReturnType<typeof createMemoryStore>;
  now?: () => Date;
  randomUUID?: () => string;
  userId?: string;
  code?: string;
}): Promise<{
  service: SpotifyService;
  store: ReturnType<typeof createMemoryStore>;
  state: string;
  linkResult: Awaited<ReturnType<SpotifyService["completeAuthorization"]>>;
}> {
  const store = options.store ?? createMemoryStore();
  const service = createSpotifyService(baseEnv(), {
    store,
    fetchImpl: options.fetchImpl,
    now: options.now,
    randomUUID: options.randomUUID
  });
  const userId = options.userId ?? "user-1";
  const code = options.code ?? "code-1";
  const { state } = await service.startAuthorization(userId);
  const linkResult = await service.completeAuthorization(userId, code, state);

  return { service, store, state, linkResult };
}
