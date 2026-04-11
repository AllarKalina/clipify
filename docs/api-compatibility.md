---
read_when:
  - changing route payloads used by CLI
  - planning API version bumps
---

# API Compatibility Policy

## Contract

- Backend compatibility target: CLI `N` and `N-1`.
- Breaking response shape changes require a new API version path (`/v2/...`).
- Non-breaking fields may be added; required field removals are breaking.

## Current Baseline

- CLI integration contract is the `/v1/cli/*` surface.
- Lightweight player polling is served by `GET /v1/cli/player/snapshot`; full browse/library hydration remains on `GET /v1/cli/bootstrap`.
- Legacy `/v1/spotify/*` endpoints were removed during the architecture cleanup and are no longer part of the supported contract.
- Compatibility guarantees apply to `/v1/public/meta/version`, `/v1/me`, `/v1/cli/*`, and `/api/auth/*`.

## Required Metadata Endpoint

- Route: `GET /v1/public/meta/version`
- Response fields:
  - `appName`
  - `apiVersion`
  - `minCliVersion`
  - `latestCliVersion`

## CLI Behavior

- CLI checks metadata via `@clipify/api-client`.
- If CLI version is below `minCliVersion`, command should fail with upgrade guidance.
- If CLI version is below `latestCliVersion` but still supported, command should warn.

## Rollout Checklist

1. Additive API changes first.
2. Release backend with updated compatibility metadata.
3. Release CLI update.
4. Remove legacy behavior only after `N-1` support window closes.
