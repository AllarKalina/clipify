import { describe, expect, test } from "bun:test";
import { ApiClientError, createApiClient } from "../src/client";

describe("api client", () => {
  test("returns parsed version metadata", async () => {
    const client = createApiClient({
      baseUrl: "https://example.com",
      fetchImpl: async () =>
        new Response(
          JSON.stringify({
            appName: "clipify-api",
            apiVersion: "v1",
            minCliVersion: "0.1.0",
            latestCliVersion: "0.1.0"
          })
        )
    });

    const payload = await client.getVersion();
    expect(payload.apiVersion).toBe("v1");
  });

  test("throws on non-2xx response", async () => {
    const client = createApiClient({
      baseUrl: "https://example.com",
      fetchImpl: async () => new Response("nope", { status: 503 })
    });

    expect(client.getVersion()).rejects.toBeInstanceOf(ApiClientError);
  });
});
