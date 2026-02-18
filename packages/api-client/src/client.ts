import { z } from "zod";
import type { PublicExampleResponse, PublicVersionResponse } from "../../../apps/api/src/modules/public/contracts";

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
};

type FetchLike = (input: URL | Request | string, init?: RequestInit) => Promise<Response>;

type ClientDeps = {
  baseUrl: string;
  fetchImpl?: FetchLike;
};

export function createApiClient({ baseUrl, fetchImpl = fetch }: ClientDeps): ApiClient {
  async function request<T>(path: string, schema: z.ZodType<T>): Promise<T> {
    const response = await fetchImpl(new URL(path, baseUrl), {
      method: "GET",
      headers: {
        accept: "application/json"
      }
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

  return {
    getVersion() {
      return request("/v1/public/meta/version", versionSchema);
    },
    getPublicExample() {
      return request("/v1/public/example", publicExampleSchema);
    }
  };
}
