import { describe, expect, test } from "bun:test";
import type { ApiClient } from "@clipify/api-client";
import { createAuthFormState } from "../src/auth-form";
import { submitAuthForm } from "../src/auth-controller";

function createClient(overrides: Partial<Pick<ApiClient, "signInWithEmailPassword" | "signUpWithEmailPassword">>): Pick<
  ApiClient,
  "signInWithEmailPassword" | "signUpWithEmailPassword"
> {
  return {
    signInWithEmailPassword: async () => {
      throw new Error("signInWithEmailPassword not mocked");
    },
    signUpWithEmailPassword: async () => {
      throw new Error("signUpWithEmailPassword not mocked");
    },
    ...overrides
  };
}

describe("auth submit controller", () => {
  test("successful signup persists session and returns success", async () => {
    const persisted: string[] = [];
    const form = createAuthFormState("signup", {
      name: "Allar",
      email: "allar@example.com",
      password: "Tere1234"
    });

    const result = await submitAuthForm(form, {
      client: createClient({
        signUpWithEmailPassword: async (input) => {
          expect(input).toEqual({
            name: "Allar",
            email: "allar@example.com",
            password: "Tere1234"
          });
          return { sessionCookie: "better-auth.session_token=signup-cookie" };
        }
      }),
      persistSession(sessionCookie) {
        persisted.push(sessionCookie);
      }
    });

    expect(result).toEqual({
      kind: "success",
      mode: "signup",
      sessionCookie: "better-auth.session_token=signup-cookie",
      successLine: "Sign up successful"
    });
    expect(persisted).toEqual(["better-auth.session_token=signup-cookie"]);
  });

  test("successful login persists session and returns success", async () => {
    const persisted: string[] = [];
    const form = createAuthFormState("login", {
      email: "allar@example.com",
      password: "Tere1234"
    });

    const result = await submitAuthForm(form, {
      client: createClient({
        signInWithEmailPassword: async (input) => {
          expect(input).toEqual({
            email: "allar@example.com",
            password: "Tere1234"
          });
          return { sessionCookie: "better-auth.session_token=login-cookie" };
        }
      }),
      persistSession(sessionCookie) {
        persisted.push(sessionCookie);
      }
    });

    expect(result).toEqual({
      kind: "success",
      mode: "login",
      sessionCookie: "better-auth.session_token=login-cookie",
      successLine: "Login successful"
    });
    expect(persisted).toEqual(["better-auth.session_token=login-cookie"]);
  });

  test("failed login preserves values and returns inline error", async () => {
    const form = createAuthFormState("login", {
      email: "allar@example.com",
      password: "Tere1234"
    });

    const result = await submitAuthForm(form, {
      client: createClient({
        signInWithEmailPassword: async () => {
          throw new Error("Unauthorized");
        }
      }),
      persistSession() {
        throw new Error("should not persist");
      }
    });

    expect(result.kind).toBe("error");
    if (result.kind !== "error") {
      throw new Error("expected error");
    }
    expect(result.form.values).toEqual(form.values);
    expect(result.form.message?.text).toBe("Login failed: Unauthorized");
  });

  test("validation failure focuses first invalid field before submit", async () => {
    const form = createAuthFormState("signup", {
      name: "",
      email: "not-an-email",
      password: "short"
    });

    const result = await submitAuthForm(form, {
      client: createClient({}),
      persistSession() {
        throw new Error("should not persist");
      }
    });

    expect(result.kind).toBe("error");
    if (result.kind !== "error") {
      throw new Error("expected error");
    }
    expect(result.form.focus).toEqual({ kind: "field", field: "name" });
    expect(result.form.message?.text).toBe("Name is required");
  });
});
