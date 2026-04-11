import { Elysia } from "elysia";
import type { AppAuth } from "./service";

export function authModule(auth: AppAuth) {
  return new Elysia({ name: "auth" }).mount("/api/auth", auth.handler);
}
