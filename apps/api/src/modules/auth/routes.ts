import { Elysia } from "elysia";
import type { AppAuth } from "./service";

export function authModule(auth: AppAuth) {
  return new Elysia({ name: "auth" }).all("/api/auth/*", async ({ request }) => {
    return auth.handler(request);
  });
}
