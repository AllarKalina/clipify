import type { ApiClient } from "@clipify/api-client";
import { focusFirstInvalidField, type AuthFormState, type AuthMode, validateAuthForm } from "./auth-form";

type AuthClient = Pick<ApiClient, "signInWithEmailPassword" | "signUpWithEmailPassword">;

export type AuthSubmitResult =
  | {
      kind: "success";
      mode: AuthMode;
      sessionCookie: string;
      successLine: string;
    }
  | {
      kind: "error";
      form: AuthFormState;
    };

type SubmitAuthFormDeps = {
  client: AuthClient;
  persistSession: (sessionCookie: string) => void;
};

function toMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function withError(form: AuthFormState, text: string): AuthSubmitResult {
  return {
    kind: "error",
    form: {
      ...form,
      message: {
        tone: "error",
        text
      }
    }
  };
}

export function getAuthLauncherSelection(mode: AuthMode): "signup" | "login" {
  return mode === "signup" ? "signup" : "login";
}

export async function submitAuthForm(form: AuthFormState, deps: SubmitAuthFormDeps): Promise<AuthSubmitResult> {
  const validationError = validateAuthForm(form);
  if (validationError) {
    return {
      kind: "error",
      form: focusFirstInvalidField(form)
    };
  }

  try {
    if (form.mode === "signup") {
      const result = await deps.client.signUpWithEmailPassword({
        name: form.values.name.trim(),
        email: form.values.email.trim(),
        password: form.values.password
      });
      deps.persistSession(result.sessionCookie);
      return {
        kind: "success",
        mode: "signup",
        sessionCookie: result.sessionCookie,
        successLine: "Sign up successful"
      };
    }

    const result = await deps.client.signInWithEmailPassword({
      email: form.values.email.trim(),
      password: form.values.password
    });
    deps.persistSession(result.sessionCookie);
    return {
      kind: "success",
      mode: "login",
      sessionCookie: result.sessionCookie,
      successLine: "Login successful"
    };
  } catch (error) {
    return withError(form, form.mode === "signup" ? `Sign up failed: ${toMessage(error)}` : `Login failed: ${toMessage(error)}`);
  }
}
