import { Elysia } from "elysia";
import type { AppAuth } from "../modules/auth/service";
import { cacheProtectedSession, type AuthSession } from "../modules/auth/session";

function isProtectedPath(pathname: string): boolean {
  return pathname === "/v1/me" || pathname.startsWith("/v1/cli/");
}

export type ProtectedSessionContext = {
  protectedSession: AuthSession | null;
};

export function createProtectedSessionPlugin(auth: AppAuth) {
  return new Elysia({ name: "protected-session" }).derive(async ({ request }) => {
    const pathname = new URL(request.url).pathname;

    if (!isProtectedPath(pathname)) {
      return {
        protectedSession: null
      };
    }

    return {
      protectedSession: await cacheProtectedSession(auth, request)
    };
  });
}
