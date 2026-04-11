import { treaty } from "@elysiajs/eden";
import type { ApiApp } from "@clipify/api/client-contract";
import type {
  CliAuthStartResponse,
  CliAuthStatusResponse,
  CliBootstrapResponse,
  CliDevicesResponse,
  CliErrorCode,
  CliLibraryViewResponse,
  CliPlayerActionRequest,
  CliPlayerActionResponse,
  CliPlayerSnapshotResponse,
  CliSearchResponse,
  PublicVersionResponse
} from "@clipify/contracts";

export class ApiClientError extends Error {
  readonly status: number;
  readonly path: string;
  readonly code?: CliErrorCode;

  constructor(message: string, status: number, path: string, code?: CliErrorCode) {
    super(message);
    this.name = "ApiClientError";
    this.status = status;
    this.path = path;
    this.code = code;
  }
}

export type ApiClient = {
  getVersion: () => Promise<PublicVersionResponse>;
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
  startCliAuthorization: () => Promise<CliAuthStartResponse>;
  getCliAuthorizationStatus: () => Promise<CliAuthStatusResponse>;
  getCliBootstrap: () => Promise<CliBootstrapResponse>;
  getCliPlayerSnapshot: () => Promise<CliPlayerSnapshotResponse>;
  getCliLibraryView: (libraryId: string) => Promise<CliLibraryViewResponse>;
  searchCli: (query: string) => Promise<CliSearchResponse>;
  getCliDevices: () => Promise<CliDevicesResponse>;
  runCliPlayerAction: (request: CliPlayerActionRequest) => Promise<CliPlayerActionResponse>;
};

type FetchLike = (input: URL | Request | string, init?: RequestInit) => Promise<Response>;

type ClientDeps = {
  baseUrl: string;
  fetchImpl?: FetchLike;
  sessionCookie?: string;
};

type FailureInfo = {
  message: string;
  code?: CliErrorCode;
};

type TreatyResult<T> = {
  data: T | null;
  error: unknown;
  status: number;
};

export function createApiClient({ baseUrl, fetchImpl = fetch, sessionCookie }: ClientDeps): ApiClient {
  const authOrigin = new URL(baseUrl).origin;
  const networkRetryDelayMs = 150;
  const bff = treaty<ApiApp>(baseUrl, {
    fetcher: requestWithRetry as typeof fetch,
    throwHttpError: false
  });

  function isRetriableNetworkError(error: unknown): boolean {
    if (!(error instanceof Error)) {
      return false;
    }

    const message = error.message.toLowerCase();
    return (
      message.includes("unable to connect") ||
      message.includes("failed to fetch") ||
      message.includes("fetch failed") ||
      message.includes("connection refused")
    );
  }

  async function requestWithRetry(input: URL | Request | string, init?: RequestInit): Promise<Response> {
    try {
      return await fetchImpl(input, init);
    } catch (error) {
      if (!isRetriableNetworkError(error)) {
        throw error;
      }

      await new Promise((resolve) => setTimeout(resolve, networkRetryDelayMs));
      return fetchImpl(input, init);
    }
  }

  function parseSessionCookie(setCookie: string, path: string): { sessionCookie: string } {
    const match = setCookie.match(/(?:^|,\s*)better-auth\.session_token=([^;,\s]+)/);

    if (!match?.[1]) {
      throw new ApiClientError("Auth succeeded but session cookie was missing in response", 502, path);
    }

    return {
      sessionCookie: `better-auth.session_token=${match[1]}`
    };
  }

  function requireSessionCookie(path: string) {
    if (!sessionCookie) {
      throw new ApiClientError(`Missing session cookie for ${path}`, 401, path, "UNAUTHORIZED");
    }

    return {
      cookie: sessionCookie
    };
  }

  function toFailureInfo(raw: unknown, fallbackStatus: number): FailureInfo {
    if (raw && typeof raw === "object" && "value" in raw) {
      const value = (raw as { value?: unknown }).value;
      return toFailureInfo(value, fallbackStatus);
    }

    if (typeof raw === "string") {
      return {
        message: raw
      };
    }

    if (raw && typeof raw === "object") {
      const candidate = raw as {
        error?: {
          code?: CliErrorCode;
          message?: string;
        };
      };

      if (candidate.error?.message) {
        return {
          message: candidate.error.message,
          code: candidate.error.code
        };
      }
    }

    return {
      message: fallbackStatus === 401 ? "Unauthorized" : "Request failed"
    };
  }

  function unwrapTreatyResult<T>(path: string, result: TreatyResult<T>): T {
    if (result.error) {
      const status = Number(result.status || 500);
      const failure = toFailureInfo(result.error, status);
      throw new ApiClientError(`Request failed for ${path}: ${status} ${failure.message}`, status, path, failure.code);
    }

    if (result.data === null) {
      throw new ApiClientError(`Invalid response for ${path}`, 502, path);
    }

    return result.data;
  }

  async function signInWithEmailPassword(input: {
    email: string;
    password: string;
    rememberMe?: boolean;
  }): Promise<{ sessionCookie: string }> {
    const path = "/api/auth/sign-in/email";
    const url = new URL(path, baseUrl);
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
      throw new ApiClientError(`Request failed for ${path}: ${response.status} ${text}`, response.status, path);
    }

    return parseSessionCookie(response.headers.get("set-cookie") ?? "", path);
  }

  async function signUpWithEmailPassword(input: { name: string; email: string; password: string }): Promise<{ sessionCookie: string }> {
    const path = "/api/auth/sign-up/email";
    const url = new URL(path, baseUrl);
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
      throw new ApiClientError(`Request failed for ${path}: ${response.status} ${text}`, response.status, path);
    }

    return parseSessionCookie(response.headers.get("set-cookie") ?? "", path);
  }

  async function signOut(): Promise<void> {
    const path = "/api/auth/sign-out";
    if (!sessionCookie) {
      throw new ApiClientError(`Missing session cookie for ${path}`, 401, path, "UNAUTHORIZED");
    }

    const url = new URL(path, baseUrl);
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
      throw new ApiClientError(`Request failed for ${path}: ${response.status} ${text}`, response.status, path);
    }
  }

  return {
    async getVersion() {
      return unwrapTreatyResult("/v1/public/meta/version", await bff.v1.public.meta.version.get());
    },
    async getMe() {
      return unwrapTreatyResult("/v1/me", await bff.v1.me.get({ headers: requireSessionCookie("/v1/me") }));
    },
    signUpWithEmailPassword,
    signInWithEmailPassword,
    signOut,
    async startCliAuthorization() {
      return unwrapTreatyResult(
        "/v1/cli/auth/start",
        await bff.v1.cli.auth.start.get({ headers: requireSessionCookie("/v1/cli/auth/start") })
      );
    },
    async getCliAuthorizationStatus() {
      return unwrapTreatyResult(
        "/v1/cli/auth/status",
        await bff.v1.cli.auth.status.get({ headers: requireSessionCookie("/v1/cli/auth/status") })
      );
    },
    async getCliBootstrap() {
      return unwrapTreatyResult(
        "/v1/cli/bootstrap",
        await bff.v1.cli.bootstrap.get({ headers: requireSessionCookie("/v1/cli/bootstrap") })
      );
    },
    async getCliPlayerSnapshot() {
      return unwrapTreatyResult(
        "/v1/cli/player/snapshot",
        await bff.v1.cli.player.snapshot.get({ headers: requireSessionCookie("/v1/cli/player/snapshot") })
      );
    },
    async getCliLibraryView(libraryId) {
      const encodedLibraryId = encodeURIComponent(libraryId);
      return unwrapTreatyResult(
        `/v1/cli/view/library/${encodedLibraryId}`,
        await bff.v1.cli.view.library({ libraryId: encodedLibraryId }).get({
          headers: requireSessionCookie("/v1/cli/view/library/:libraryId")
        })
      );
    },
    async searchCli(query) {
      return unwrapTreatyResult(
        "/v1/cli/search",
        await bff.v1.cli.search.get({
          query: { q: query },
          headers: requireSessionCookie("/v1/cli/search")
        })
      );
    },
    async getCliDevices() {
      return unwrapTreatyResult(
        "/v1/cli/devices",
        await bff.v1.cli.devices.get({ headers: requireSessionCookie("/v1/cli/devices") })
      );
    },
    async runCliPlayerAction(action) {
      return unwrapTreatyResult(
        "/v1/cli/player/action",
        await bff.v1.cli.player.action.post(action, {
          headers: requireSessionCookie("/v1/cli/player/action")
        })
      );
    }
  };
}
