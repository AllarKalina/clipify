import { z } from "zod";
import type {
  CliAuthStartResponse,
  CliAuthStatusResponse,
  CliBootstrapResponse,
  CliDevicesResponse,
  CliLibraryViewResponse,
  CliPlayerActionRequest,
  CliPlayerActionResponse,
  CliPlayerSnapshotResponse,
  CliSearchResponse,
  PublicVersionResponse
} from "@clipify/contracts";
import {
  cliAuthStartSchema,
  cliAuthStatusSchema,
  cliBootstrapSchema,
  cliDevicesSchema,
  cliLibraryViewSchema,
  cliPlayerActionRequestSchema,
  cliPlayerActionSchema,
  cliPlayerSnapshotSchema,
  cliSearchSchema,
  meSchema,
  versionSchema
} from "@clipify/contracts";

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
      throw new ApiClientError(`Missing session cookie for ${path}`, 401, path);
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
    getVersion() {
      return request("/v1/public/meta/version", { schema: versionSchema });
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
    startCliAuthorization() {
      return request("/v1/cli/auth/start", {
        schema: cliAuthStartSchema,
        requireSession: true
      });
    },
    getCliAuthorizationStatus() {
      return request("/v1/cli/auth/status", {
        schema: cliAuthStatusSchema,
        requireSession: true
      });
    },
    getCliBootstrap() {
      return request("/v1/cli/bootstrap", {
        schema: cliBootstrapSchema,
        requireSession: true
      });
    },
    getCliPlayerSnapshot() {
      return request("/v1/cli/player/snapshot", {
        schema: cliPlayerSnapshotSchema,
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
        schema: cliSearchSchema,
        query: { q: query },
        requireSession: true
      });
    },
    getCliDevices() {
      return request("/v1/cli/devices", {
        schema: cliDevicesSchema,
        requireSession: true
      });
    },
    runCliPlayerAction(action) {
      const parsed = cliPlayerActionRequestSchema.safeParse(action);
      if (!parsed.success) {
        throw new ApiClientError("Invalid CLI player action input", 400, "/v1/cli/player/action");
      }

      return post("/v1/cli/player/action", cliPlayerActionSchema, true, parsed.data);
    }
  };
}
