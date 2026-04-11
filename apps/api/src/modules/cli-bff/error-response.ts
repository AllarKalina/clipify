import { t } from "elysia";

export type CliErrorCode =
  | "UNAUTHORIZED"
  | "INVALID_INPUT"
  | "RELINK_REQUIRED"
  | "PREMIUM_REQUIRED"
  | "NO_ACTIVE_DEVICE"
  | "DEVICE_RESTRICTED"
  | "NOT_FOUND"
  | "FORBIDDEN"
  | "CONFLICT"
  | "UPSTREAM_FAILURE"
  | "SERVICE_UNAVAILABLE"
  | "BAD_REQUEST"
  | "INTERNAL_ERROR";

export type CliErrorPayload = {
  error: {
    code: CliErrorCode;
    message: string;
    hint?: string;
  };
};

export type CliErrorStatus = 400 | 401 | 403 | 404 | 409 | 500 | 502 | 503;

export const cliErrorResponseSchema = t.Object({
  error: t.Object({
    code: t.Union([
      t.Literal("UNAUTHORIZED"),
      t.Literal("INVALID_INPUT"),
      t.Literal("RELINK_REQUIRED"),
      t.Literal("PREMIUM_REQUIRED"),
      t.Literal("NO_ACTIVE_DEVICE"),
      t.Literal("DEVICE_RESTRICTED"),
      t.Literal("NOT_FOUND"),
      t.Literal("FORBIDDEN"),
      t.Literal("CONFLICT"),
      t.Literal("UPSTREAM_FAILURE"),
      t.Literal("SERVICE_UNAVAILABLE"),
      t.Literal("BAD_REQUEST"),
      t.Literal("INTERNAL_ERROR")
    ]),
    message: t.String(),
    hint: t.Optional(t.String())
  })
});

export const cliErrorResponses = {
  400: cliErrorResponseSchema,
  401: cliErrorResponseSchema,
  403: cliErrorResponseSchema,
  404: cliErrorResponseSchema,
  409: cliErrorResponseSchema,
  500: cliErrorResponseSchema,
  502: cliErrorResponseSchema,
  503: cliErrorResponseSchema
} as const;

function normalizeErrorStatus(status: number): CliErrorStatus {
  if (status === 400 || status === 401 || status === 403 || status === 404 || status === 409 || status === 500 || status === 502 || status === 503) {
    return status;
  }

  return 500;
}

function mapErrorCode(status: CliErrorStatus, message: string): CliErrorPayload["error"] {
  const lowered = message.toLowerCase();

  if (status === 401) {
    return { code: "UNAUTHORIZED", message: "Unauthorized. Please log in again." };
  }

  if (status === 400) {
    if (lowered.includes("device id is required")) {
      return { code: "INVALID_INPUT", message: "Device id is required." };
    }

    return { code: "BAD_REQUEST", message: message || "Invalid request." };
  }

  if (status === 403) {
    if (lowered.includes("fresh spotify re-link") || lowered.includes("insufficient client scope")) {
      return {
        code: "RELINK_REQUIRED",
        message: "Playback control needs a fresh Spotify re-link.",
        hint: "Press [l] to re-link Spotify."
      };
    }

    if (lowered.includes("premium")) {
      return {
        code: "PREMIUM_REQUIRED",
        message: "Spotify Premium is required for this playback control."
      };
    }

    return { code: "FORBIDDEN", message: message || "Forbidden." };
  }

  if (status === 404) {
    return { code: "NOT_FOUND", message: message || "Resource not found." };
  }

  if (status === 409) {
    if (lowered.includes("no active spotify device")) {
      return {
        code: "NO_ACTIVE_DEVICE",
        message: "No active Spotify device. Start playback in Spotify first.",
        hint: "Press [d] to transfer playback or start playback in Spotify."
      };
    }

    if (lowered.includes("restricted")) {
      return {
        code: "DEVICE_RESTRICTED",
        message: "Playback is restricted on the current Spotify device.",
        hint: "Pick a different device with [d]."
      };
    }

    return { code: "CONFLICT", message: message || "Conflict." };
  }

  if (status === 503) {
    return { code: "SERVICE_UNAVAILABLE", message: message || "Service unavailable." };
  }

  if (status === 502) {
    return { code: "UPSTREAM_FAILURE", message: message || "Upstream request failed." };
  }

  return { code: "INTERNAL_ERROR", message: message || "Unexpected server error." };
}

export async function toCliErrorPayload(error: unknown): Promise<{ status: CliErrorStatus; body: CliErrorPayload }> {
  if (error instanceof Response) {
    const status = normalizeErrorStatus(error.status);
    const message = (await error.text()).trim();
    return {
      status,
      body: {
        error: mapErrorCode(status, message)
      }
    };
  }

  const message = error instanceof Error ? error.message : "Unexpected server error.";
  return {
    status: 500,
    body: {
      error: mapErrorCode(500, message)
    }
  };
}
