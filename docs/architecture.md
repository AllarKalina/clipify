---
read_when:
  - changing monorepo layout
  - adding new CLI commands
  - adding new backend modules
---

# Clipify Monorepo Architecture

## Purpose

Define stable boundaries between API, CLI, and shared client package so iteration stays predictable.

## Repo Shape

```text
apps/
  api/
  cli/
packages/
  api-client/
  tsconfig/
```

## Boundary Rules

- `apps/api` owns transport, auth, business logic, and all direct Spotify API communication.
- `apps/cli` owns UX, command parsing, and local config only.
- `packages/api-client` owns HTTP calls and runtime response validation for CLI.
- CLI code must not call backend endpoints directly with ad-hoc `fetch`.

## Data Flow

1. User runs `clipify` command.
2. CLI calls `@clipify/api-client`.
3. API client calls hosted backend.
4. Backend handles auth/session and Spotify integration.
5. API client validates response shape before CLI displays output.

## Versioning Contract

- All business endpoints remain versioned under `/v1/*`.
- Backend exposes compatibility metadata at `/v1/public/meta/version`.
- Backend keeps compatibility for current CLI and one previous CLI release (`N`, `N-1`).

## Scaling Rules

- New domain behavior in API: add module under `apps/api/src/modules/<domain>`.
- New reusable CLI/API transport logic: add in `packages/api-client`.
- New CLI feature: add command surface in `apps/cli/src/index.ts` and supporting modules if file grows.
