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
  | "RATE_LIMITED"
  | "BAD_REQUEST"
  | "INTERNAL_ERROR";

export type CliErrorPayload = {
  error: {
    code: CliErrorCode;
    message: string;
    hint?: string;
  };
};

export type CliErrorStatus = 400 | 401 | 403 | 404 | 409 | 429 | 500 | 502 | 503;

export const cliErrorModelNames = {
  response: "CliErrorResponse"
} as const;

export class CliBffError extends Error {
  readonly status: CliErrorStatus;
  readonly code: CliErrorCode;
  readonly hint?: string;

  constructor(status: CliErrorStatus, code: CliErrorCode, message: string, hint?: string) {
    super(message);
    this.name = "CliBffError";
    this.status = status;
    this.code = code;
    this.hint = hint;
  }
}

export function createCliBffError(status: CliErrorStatus, code: CliErrorCode, message: string, hint?: string) {
  return new CliBffError(status, code, message, hint);
}

export function isCliBffError(error: unknown): error is CliBffError {
  return error instanceof CliBffError;
}

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
      t.Literal("RATE_LIMITED"),
      t.Literal("BAD_REQUEST"),
      t.Literal("INTERNAL_ERROR")
    ]),
    message: t.String(),
    hint: t.Optional(t.String())
  })
});

export const cliErrorModels = {
  [cliErrorModelNames.response]: cliErrorResponseSchema
} as const;

export const cliErrorResponses = {
  400: cliErrorResponseSchema,
  401: cliErrorResponseSchema,
  403: cliErrorResponseSchema,
  404: cliErrorResponseSchema,
  409: cliErrorResponseSchema,
  429: cliErrorResponseSchema,
  500: cliErrorResponseSchema,
  502: cliErrorResponseSchema,
  503: cliErrorResponseSchema
} as const;

function normalizeErrorStatus(status: number): CliErrorStatus {
  if (status === 400 || status === 401 || status === 403 || status === 404 || status === 409 || status === 429 || status === 500 || status === 502 || status === 503) {
    return status;
  }

  return 500;
}

function defaultErrorForStatus(status: CliErrorStatus): CliErrorPayload["error"] {
  switch (status) {
    case 400:
      return { code: "BAD_REQUEST", message: "Invalid request." };
    case 401:
      return { code: "UNAUTHORIZED", message: "Unauthorized. Please log in again." };
    case 403:
      return { code: "FORBIDDEN", message: "Forbidden." };
    case 404:
      return { code: "NOT_FOUND", message: "Resource not found." };
    case 409:
      return { code: "CONFLICT", message: "Conflict." };
    case 429:
      return { code: "RATE_LIMITED", message: "Rate limit reached." };
    case 502:
      return { code: "UPSTREAM_FAILURE", message: "Upstream request failed." };
    case 503:
      return { code: "SERVICE_UNAVAILABLE", message: "Service unavailable." };
    default:
      return { code: "INTERNAL_ERROR", message: "Unexpected server error." };
  }
}

function refineErrorFromMessage(
  status: CliErrorStatus,
  message: string,
  fallback: CliErrorPayload["error"]
): CliErrorPayload["error"] {
  const lowered = message.toLowerCase();

  if (status === 400 && lowered.includes("device id is required")) {
    return { code: "INVALID_INPUT", message: "Device id is required." };
  }

  if (status === 403 && (lowered.includes("fresh spotify re-link") || lowered.includes("insufficient client scope"))) {
    return {
      code: "RELINK_REQUIRED",
      message: "Playback control needs a fresh Spotify re-link.",
      hint: "Press [l] to re-link Spotify."
    };
  }

  if (status === 403 && lowered.includes("premium")) {
    return {
      code: "PREMIUM_REQUIRED",
      message: "Spotify Premium is required for this playback control."
    };
  }

  if (status === 409 && lowered.includes("no active spotify device")) {
    return {
      code: "NO_ACTIVE_DEVICE",
      message: "No active Spotify device. Start playback in Spotify first.",
      hint: "Press [d] to transfer playback or start playback in Spotify."
    };
  }

  if (status === 409 && lowered.includes("restricted")) {
    return {
      code: "DEVICE_RESTRICTED",
      message: "Playback is restricted on the current Spotify device.",
      hint: "Pick a different device with [d]."
    };
  }

  if (message) {
    return {
      ...fallback,
      message
    };
  }

  return fallback;
}

async function readResponseErrorPayload(error: Response): Promise<CliErrorPayload["error"] | null> {
  const contentType = error.headers.get("content-type")?.toLowerCase() ?? "";
  if (!contentType.includes("application/json")) {
    return null;
  }

  try {
    const parsed = (await error.clone().json()) as {
      error?: {
        code?: CliErrorCode;
        message?: string;
        hint?: string;
      };
    };
    if (!parsed.error?.code || !parsed.error?.message) {
      return null;
    }

    return {
      code: parsed.error.code,
      message: parsed.error.message,
      hint: parsed.error.hint
    };
  } catch {
    return null;
  }
}

async function toCliBffErrorFromResponse(error: Response): Promise<CliBffError> {
  const status = normalizeErrorStatus(error.status);
  const parsed = await readResponseErrorPayload(error);
  if (parsed) {
    return createCliBffError(status, parsed.code, parsed.message, parsed.hint);
  }

  const text = await error.text();
  const fallback = defaultErrorForStatus(status);
  const resolved = refineErrorFromMessage(status, text.trim(), fallback);
  return createCliBffError(status, resolved.code, resolved.message, resolved.hint);
}

export async function toCliErrorPayload(error: unknown): Promise<{ status: CliErrorStatus; body: CliErrorPayload }> {
  if (isCliBffError(error)) {
    return {
      status: error.status,
      body: {
        error: {
          code: error.code,
          message: error.message,
          hint: error.hint
        }
      }
    };
  }

  if (error instanceof Response) {
    const resolved = await toCliBffErrorFromResponse(error);
    return {
      status: resolved.status,
      body: {
        error: {
          code: resolved.code,
          message: resolved.message,
          hint: resolved.hint
        }
      }
    };
  }

  const fallback = defaultErrorForStatus(500);
  const message = error instanceof Error ? error.message : fallback.message;
  return {
    status: 500,
    body: {
      error: {
        ...fallback,
        message
      }
    }
  };
}
