import { Elysia } from "elysia";
import type { AppAuth } from "../modules/auth/service";
import { cacheProtectedSession, type AuthSession } from "../modules/auth/session";

export type ProtectedSessionContext = {
  protectedSession: AuthSession | null;
};

export function createProtectedSessionPlugin(auth: AppAuth, prefix: string) {
  return new Elysia({ name: `protected-session:${prefix}`, prefix }).derive(async ({ request }) => {
    return {
      protectedSession: await cacheProtectedSession(auth, request)
    };
  });
}
