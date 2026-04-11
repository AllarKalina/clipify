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
- BFF error responses are JSON envelopes: `{ error: { code, message, hint? } }`.
- `/v1/spotify/*` routes are not part of the supported surface.
- Supported route families: `/v1/public/*`, `/v1/me`, `/v1/cli/*`, and `/api/auth/*`.

## Version Metadata Endpoint

- Route: `GET /v1/public/meta/version`
- Response fields:
  - `appName`
  - `apiVersion`
  - `minCliVersion`
  - `latestCliVersion`

## CLI Behavior

- CLI checks metadata via `@clipify/api-client`.
- CLI transport uses Elysia-inferred route types/status unions from API route schemas.
- If CLI version is below `minCliVersion`, command fails with upgrade guidance.
- `latestCliVersion` is advisory.

## Change Checklist

1. Update API + CLI together for contract changes.
2. Update docs in the same PR.
3. Remove obsolete routes/helpers/tests immediately.
