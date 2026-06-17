---
read_when:
  - changing route payloads used by CLI
  - planning API version bumps
---

# API Evolution Policy (Development Phase)

## Development Contract

- Clipify is pre-production and not used in production yet.
- Do not add compatibility aliases or fallback routes for removed behavior.
- When API and CLI drift, update both in the same change instead of preserving old contracts.
- Breaking changes are allowed during development when they simplify the architecture.

## Current Baseline

- CLI integration contract is the `/v1/cli/*` surface.
- Lightweight player polling is served by `GET /v1/cli/player/snapshot`; full browse/library hydration remains on `GET /v1/cli/bootstrap`.
- CLI player snapshots include `home.contextUri`, the current Spotify context URI when one is available, or an empty string.
- BFF error responses are JSON envelopes: `{ error: { code, message, hint? } }`.
- `/v1/me` unauthorized responses follow the same structured envelope style (`{ error: { code, message } }`).
- CLI BFF errors are normalized through typed application errors first, then status-aware fallback mapping for upstream `Response` failures.
- Supported route families: `/v1/public/*`, `/v1/me`, `/v1/cli/*`, and explicit `/api/auth/*` endpoints (`sign-in/email`, `sign-up/email`, `sign-out`).
- OpenAPI spec is available at `/openapi/json` (`/openapi` UI is non-production only).
- API responses include `x-request-id`; OpenAPI should annotate route headers explicitly when the header is part of the contract.
- Better Auth remains wrapped by explicit `/api/auth/*` routes in this repo; OpenAPI now also merges Better Auth native schema metadata under the same `/api/auth/*` prefix.
- Elysia `fromTypes(...)` remains deferred until monorepo typegen becomes stable enough to generate clean docs without warnings.
- Route-level rate limits may return `429` envelopes with code `RATE_LIMITED`.
- Forwarded IP headers are ignored for rate-limit keying unless `RATE_LIMIT_TRUST_PROXY_HEADERS=true`.
- Spotify playlist payload handling is strict: playlist counts come from `items.total`, playlist item entries come from `items[].item`, and playlist/liked track added dates are exposed as optional `addedAt` fields.

## Version Metadata Endpoint

- Route: `GET /v1/public/meta/version`
- Response fields:
  - `appName`
  - `apiVersion`
  - `minCliVersion`
  - `latestCliVersion`

## CLI Behavior

- CLI checks metadata via `@clipify/api-client`.
- CLI transport uses Elysia-inferred route types/status unions from API route schemas and maps non-2xx statuses to `ApiClientError` codes.
- If CLI version is below `minCliVersion`, command fails with upgrade guidance.
- `latestCliVersion` is advisory.

## Change Checklist

1. Update API + CLI together for contract changes.
2. Update docs in the same PR.
3. Remove obsolete routes/helpers/tests immediately.
