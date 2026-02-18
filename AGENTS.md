# AGENTS.md (Project-Specific)

Scope: this repo only (`bun-backend-template`).
Source of truth for architecture: `docs/backend-architecture-standard.md`.

## Intent

Template for new Bun backends.
Priority: consistency across forks/agent iterations.

## Stack Contract (do not drift by default)

- HTTP: Elysia
- DB: Postgres + Drizzle
- Auth: Better Auth (email/password + session)
- API docs: OpenAPI plugin
- Telemetry: OpenTelemetry plugin + JSON logs + request-id

If changing any stack default: add ADR in `docs/` and update `docs/backend-architecture-standard.md`.

## Route Contract

- Public routes under `/v1/public/*`
- App routes under `/v1/*`
- Auth routes under `/api/auth/*`
- System routes fixed: `/health`, `/ready`
- Business APIs must stay versioned (no unversioned business endpoints)

## Module Boundaries

- Route files = transport only (parse/validate/auth orchestration)
- Business logic in module service/model files
- DB access only from module service/data layer (not route handlers)
- Shared cross-cutting behavior only via `src/plugins/*`

## Schema + OpenAPI Rules

- Every route needs explicit request/response schema
- Include OpenAPI summary + tags on new routes
- Keep `/openapi/json` valid after route changes
- In production, docs UI stays off; JSON spec stays on

## Data + Migration Rules

- Schema change requires migration in `migrations/`
- Keep migration + schema updates in same PR
- No hidden/manual schema drift between `src/db/schema.ts` and SQL migrations

## Auth Rules

- Protected routes must use session guard path
- Never trust client-only auth checks
- Do not log secrets/tokens/session raw values

## Env Contract

- Add new env vars to:
  - `src/config/env.ts` (validation)
  - `.env.example` (documented defaults/placeholders)
  - `README.md` (behavior notes when non-obvious)
- Fail fast on invalid/missing required env

## Test Contract (repo-specific gate)

Required before handoff:

- `bun run typecheck`
- `bun run test`

When changing route/auth/db behavior:

- add or update regression tests in `test/`
- include at least one negative/failure-path assertion

## Docs Sync Rule

When behavior/contracts change, update all impacted docs in same PR:

- `README.md`
- `docs/backend-architecture-standard.md` (if rule/policy changed)
- `docs/bun-ecosystem-plan.md` (if stack decision changed)

No doc drift between implementation and docs.
