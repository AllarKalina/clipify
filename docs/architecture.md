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
  contracts/
  tsconfig/
```

## Boundary Rules

- `apps/api` owns transport, auth, business logic, and all direct Spotify API communication.
- `apps/cli` owns UX, command parsing, and local config only.
- `packages/api-client` owns HTTP calls and runtime response validation for CLI.
- `packages/contracts` owns shared response/request type contracts consumed by API and client.
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
- Shared API contract changes: update `packages/contracts` first, then wire API + client.
- New CLI feature: add command surface in `apps/cli/src/index.ts` and supporting modules if file grows.
- CLI launcher/auth shell stays in `apps/cli/src/terminal-app.tsx`; authenticated browsing/playback orchestration belongs in dedicated controller/state modules under `apps/cli/src/`.

## CLI Shape

- `terminal-app.tsx` owns launcher/auth shell composition only.
- `authenticated-app-controller.tsx` owns authenticated-shell wiring only.
- authenticated commands, effects, selectors, and input intents live in separate CLI modules and should be extended in place instead of growing the controller.
- `app-shell.tsx` and its child view components are presentational only; they should receive derived props rather than raw orchestration state whenever possible.
- the authenticated shell is modeled as a library sidebar plus a main pane; avoid reintroducing page-tab navigation when extending the CLI.
