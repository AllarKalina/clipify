import { z } from "zod";

const optionalNonEmptyString = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z.string().min(1).optional()
);

const optionalUrl = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z.url().optional()
);

const optionalSpotifyRedirectUrl = optionalUrl.superRefine((value, context) => {
  if (!value) {
    return;
  }

  const redirectUrl = new URL(value);
  const hostname = redirectUrl.hostname.toLowerCase();
  const isLoopbackLiteral = hostname === "127.0.0.1" || hostname === "::1";

  if (hostname === "localhost") {
    context.addIssue({
      code: "custom",
      message: "SPOTIFY_REDIRECT_URI must use a loopback IP literal (127.0.0.1 or ::1), not localhost"
    });
    return;
  }

  if (redirectUrl.protocol === "http:" && !isLoopbackLiteral) {
    context.addIssue({
      code: "custom",
      message: "SPOTIFY_REDIRECT_URI may use http only for loopback IP literals (127.0.0.1 or ::1)"
    });
    return;
  }

  if (redirectUrl.protocol !== "https:" && redirectUrl.protocol !== "http:") {
    context.addIssue({
      code: "custom",
      message: "SPOTIFY_REDIRECT_URI must use https (or http for loopback IP literals)"
    });
  }
});

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_NAME: z.string().min(1).default("clipify-api"),
  API_VERSION: z.string().min(1).default("v1"),
  MIN_CLI_VERSION: z.string().min(1).default("0.1.0"),
  LATEST_CLI_VERSION: z.string().min(1).default("0.1.0"),
  HOST: z.string().min(1).default("0.0.0.0"),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
  DATABASE_URL: z.url(),
  BETTER_AUTH_SECRET: z.string().min(16),
  BETTER_AUTH_URL: z.url(),
  SPOTIFY_CLIENT_ID: optionalNonEmptyString,
  SPOTIFY_CLIENT_SECRET: optionalNonEmptyString,
  SPOTIFY_REDIRECT_URI: optionalSpotifyRedirectUrl,
  SPOTIFY_TOKEN_ENCRYPTION_KEY: optionalNonEmptyString,
  RATE_LIMIT_TRUST_PROXY_HEADERS: z
    .enum(["true", "false"])
    .optional()
    .transform((value) => value === "true")
    .optional(),
  OTEL_ENABLED: z
    .string()
    .optional()
    .transform((value) => value !== "false"),
  OTEL_SERVICE_NAME: z.string().min(1).optional(),
  OTEL_EXPORTER_OTLP_ENDPOINT: z.url(),
  OTEL_EXPORTER_OTLP_HEADERS: z.string().optional()
});

export type AppEnv = z.infer<typeof envSchema>;

export function readEnv(source: Record<string, string | undefined> = process.env): AppEnv {
  const parsed = envSchema.safeParse(source);

  if (!parsed.success) {
    const message = parsed.error.issues
      .map((issue) => `${issue.path.join(".") || "env"}: ${issue.message}`)
      .join("; ");

    throw new Error(`Invalid environment: ${message}`);
  }

  return parsed.data;
}
