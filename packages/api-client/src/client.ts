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

type TreatyResult<T> = {
  data: T | null;
  error: unknown;
  status: number;
};

type ParsedFailure = {
  message: string;
  code?: CliErrorCode;
  hint?: string;
};

const cliErrorCodes: CliErrorCode[] = [
  "UNAUTHORIZED",
  "INVALID_INPUT",
  "RELINK_REQUIRED",
  "PREMIUM_REQUIRED",
  "NO_ACTIVE_DEVICE",
  "DEVICE_RESTRICTED",
  "NOT_FOUND",
  "FORBIDDEN",
  "CONFLICT",
  "UPSTREAM_FAILURE",
  "SERVICE_UNAVAILABLE",
  "RATE_LIMITED",
  "BAD_REQUEST",
  "INTERNAL_ERROR"
];
const cliErrorCodeSet = new Set<string>(cliErrorCodes);

export function createApiClient({ baseUrl, fetchImpl = fetch, sessionCookie }: ClientDeps): ApiClient {
  const authOrigin = new URL(baseUrl).origin;
  const networkRetryDelayMs = 150;
  const requestWithRetry = Object.assign(
    async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
      try {
        return await fetchImpl(input, init);
      } catch (error) {
        if (!isRetriableNetworkError(error)) {
          throw error;
        }

        await new Promise((resolve) => setTimeout(resolve, networkRetryDelayMs));
        return fetchImpl(input, init);
      }
    },
    {
      preconnect: fetch.preconnect
    }
  );
  const bff = treaty<ApiApp>(baseUrl, {
    fetcher: requestWithRetry,
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

  function authHeaders(path: string): Record<string, string> {
    return {
      ...requireSessionCookie(path),
      origin: authOrigin
    };
  }

  function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
  }

  function isCliErrorCode(value: unknown): value is CliErrorCode {
    return typeof value === "string" && cliErrorCodeSet.has(value);
  }

  function readFailureDetails(error: unknown): ParsedFailure | null {
    if (!isRecord(error)) {
      return null;
    }

    if (typeof error.value === "string") {
      return {
        message: error.value
      };
    }

    if (isRecord(error.value)) {
      const envelope = error.value.error;

      if (isRecord(envelope) && typeof envelope.message === "string") {
        return {
          code: isCliErrorCode(envelope.code) ? envelope.code : undefined,
          message: envelope.message,
          hint: typeof envelope.hint === "string" ? envelope.hint : undefined
        };
      }
    }

    if (typeof error.message === "string") {
      return {
        message: error.message
      };
    }

    return null;
  }

  function defaultMessageForStatus(status: number): string {
    switch (status) {
      case 400:
        return "Invalid request.";
      case 401:
        return "Unauthorized. Please log in again.";
      case 403:
        return "Forbidden.";
      case 404:
        return "Resource not found.";
      case 409:
        return "Conflict.";
      case 429:
        return "Rate limit reached.";
      case 500:
        return "Unexpected server error.";
      case 502:
        return "Upstream request failed.";
      case 503:
        return "Service unavailable.";
      default:
        return "Request failed.";
    }
  }

  function codeForStatus(status: number, parsed?: ParsedFailure | null): CliErrorCode | undefined {
    switch (status) {
      case 400:
        return parsed?.code ?? "BAD_REQUEST";
      case 401:
        return "UNAUTHORIZED";
      case 403:
        return parsed?.code ?? "FORBIDDEN";
      case 404:
        return "NOT_FOUND";
      case 409:
        return parsed?.code ?? "CONFLICT";
      case 429:
        return "RATE_LIMITED";
      case 500:
        return "INTERNAL_ERROR";
      case 502:
        return "UPSTREAM_FAILURE";
      case 503:
        return "SERVICE_UNAVAILABLE";
      default:
        return parsed?.code;
    }
  }

  function buildFailure(path: string, status: number, error: unknown): ApiClientError {
    const parsed = readFailureDetails(error);
    const code = codeForStatus(status, parsed);
    const message = parsed?.message ?? defaultMessageForStatus(status);

    return new ApiClientError(`Request failed for ${path}: ${status} ${message}`, status, path, code);
  }

  function unwrapTreatyResult<T>(path: string, result: TreatyResult<T>): T {
    if (result.error) {
      throw buildFailure(path, Number(result.status || 500), result.error);
    }

    if (result.data === null) {
      throw new ApiClientError(`Invalid response for ${path}`, 502, path, "UPSTREAM_FAILURE");
    }

    return result.data;
  }

  function unwrapAuthCookieResult<T>(
    path: string,
    result: TreatyResult<T> & {
      response: Response;
      headers: Record<string, string>;
    }
  ): { sessionCookie: string } {
    const payload = unwrapTreatyResult(path, result);
    void payload;
    return parseSessionCookie(result.response.headers.get("set-cookie") ?? "", path);
  }

  async function signInWithEmailPassword(input: {
    email: string;
    password: string;
    rememberMe?: boolean;
  }): Promise<{ sessionCookie: string }> {
    const path = "/api/auth/sign-in/email";
    return unwrapAuthCookieResult(
      path,
      await bff.api.auth["sign-in"].email.post(
        {
          email: input.email,
          password: input.password,
          rememberMe: input.rememberMe ?? true
        },
        {
          headers: {
            origin: authOrigin
          }
        }
      )
    );
  }

  async function signUpWithEmailPassword(input: { name: string; email: string; password: string }): Promise<{ sessionCookie: string }> {
    const path = "/api/auth/sign-up/email";
    return unwrapAuthCookieResult(
      path,
      await bff.api.auth["sign-up"].email.post(
        {
          name: input.name,
          email: input.email,
          password: input.password
        },
        {
          headers: {
            origin: authOrigin
          }
        }
      )
    );
  }

  async function signOut(): Promise<void> {
    const path = "/api/auth/sign-out";
    unwrapTreatyResult(
      path,
      await bff.api.auth["sign-out"].post(
        {},
        {
          headers: authHeaders(path)
        }
      )
    );
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
