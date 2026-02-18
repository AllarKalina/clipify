import { z } from "zod";

const optionalNonEmptyString = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z.string().min(1).optional()
);

const optionalUrl = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z.url().optional()
);

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
  SPOTIFY_REDIRECT_URI: optionalUrl,
  SPOTIFY_TOKEN_ENCRYPTION_KEY: optionalNonEmptyString,
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
