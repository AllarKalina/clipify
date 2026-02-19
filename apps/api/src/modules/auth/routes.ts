import { Elysia } from "elysia";
import type { AppAuth } from "./service";

function toAuthRequest(request: Request, body: unknown): Request {
  if (!request.bodyUsed) {
    return request.clone();
  }

  const method = request.method.toUpperCase();
  if (method === "GET" || method === "HEAD") {
    return new Request(request.url, {
      method,
      headers: request.headers
    });
  }

  const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";
  if (contentType.includes("application/x-www-form-urlencoded") && body && typeof body === "object") {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(body as Record<string, unknown>)) {
      params.set(key, String(value ?? ""));
    }

    return new Request(request.url, {
      method,
      headers: request.headers,
      body: params
    });
  }

  if (body === undefined || body === null) {
    return new Request(request.url, {
      method,
      headers: request.headers
    });
  }

  const encodedBody = typeof body === "string" ? body : JSON.stringify(body);
  return new Request(request.url, {
    method,
    headers: request.headers,
    body: encodedBody
  });
}

export function authModule(auth: AppAuth) {
  return new Elysia({ name: "auth" }).all("/api/auth/*", async ({ request, body }) => {
    return auth.handler(toAuthRequest(request, body));
  });
}
