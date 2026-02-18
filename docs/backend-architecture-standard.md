---
read_when:
  - creating new backend modules
  - adding routes, schema, auth, or DB changes
  - reviewing PRs for architectural consistency
---

# Backend Architecture Standard

Date: 2026-02-18
Status: active
Scope: all future applications created from this template

## Purpose

This document is the contract for how backend systems are designed and evolved.
Use it to keep implementation consistent across human and agent iterations.

If a change conflicts with this document, either:

1. adapt the change to comply, or
2. add an ADR that explicitly replaces the rule.

No silent exceptions.

## Core Outcomes

Every backend should optimize for:

- predictable behavior in production
- explicit contracts at boundaries
- low cognitive load for contributors
- safe evolution over speed hacks

## Baseline Stack (Default)

- Runtime/tooling: Bun
- HTTP framework: Elysia
- API contracts: Elysia route schemas + OpenAPI
- Config validation: Zod
- DB: PostgreSQL + Drizzle ORM
- Auth: Better Auth (email/password + session)
- Observability: JSON logs + request ID + OpenTelemetry
- CI gate: typecheck + tests

## Architectural Principles

1. Boundary-first design
   - validate all external input at entry points
   - never pass raw request data into domain/data code
2. Thin transport layer
   - route handlers orchestrate; they do not own business logic
3. Explicit dependencies
   - no hidden global state for DB, auth, logger, env
4. Stable module boundaries
   - domain modules do not import each other ad hoc
5. Observable by default
   - every request produces traceable logs and request IDs
6. Fail fast on invalid runtime config
   - app must not boot with broken env

## Required Project Shape

Minimum structure for production services:

```text
src/
  app.ts
  server.ts
  config/
    env.ts
  db/
    client.ts
    schema.ts
  modules/
    <domain>/
      routes.ts
      service.ts
      model.ts
  plugins/
    logger.ts
    request-id.ts
    openapi.ts
    otel.ts
migrations/
test/
docs/
```

If a domain is trivial, `model.ts` and `service.ts` can collapse into one file.
Route files should stay transport-focused.

## Request Lifecycle Contract

Each request follows this path:

1. request ID assigned or propagated
2. request start logged
3. route schema validation
4. auth/session checks (if protected)
5. service execution
6. response emitted with request ID header
7. request completion logged

Errors must be normalized before returning to clients.

## API Modeling Rules

### Route conventions

- Public routes: `/v1/public/*`
- Authenticated user routes: `/v1/*`
- System routes: `/health`, `/ready`
- Auth routes: `/api/auth/*`

### Versioning

- Never ship unversioned business APIs.
- New breaking API shape requires new version path (`/v2`).

### Schema requirements

For every route, define:

- request params/query/body schema (if used)
- response schema for each returned status code
- OpenAPI metadata: summary + tags

Do not merge route without schemas.

### Response envelope policy

Prefer direct typed payloads for normal success cases.
Use an error envelope for application errors:

```json
{
  "error": {
    "code": "SOME_CODE",
    "message": "human-readable message",
    "requestId": "uuid"
  }
}
```

## Authentication and Authorization

### Authentication baseline

- Better Auth is the default session provider.
- Email/password enabled by default.
- `BETTER_AUTH_SECRET` and `BETTER_AUTH_URL` are required.

### Authorization baseline

- Route-level guard first (`requireSession` style).
- Then domain-level checks in service layer.
- Do not rely only on frontend visibility for access control.

### Multi-tenant readiness

If tenant context is introduced later:

- tenant resolution must occur once at boundary
- tenant ID propagated through services explicitly
- all tenant-scoped queries include tenant filter

## Data Layer Rules

### DB access

- Only module services access Drizzle directly.
- Route handlers call services, not raw DB queries.

### Schema design

- Use explicit names and stable keys.
- Add `created_at`/`updated_at` for mutable entities.
- Soft-delete only when business/legal need exists.

### Migration discipline

- Every schema change ships with migration.
- No manual prod DB edits without migration artifact.
- Backward-compatible rollout for destructive changes:
  1. additive migration
  2. dual-read/write window (if needed)
  3. cleanup migration

## Error Handling Standard

### Error categories

- validation errors -> `400`
- authentication errors -> `401`
- authorization errors -> `403`
- not found -> `404`
- conflict/domain rule failures -> `409` or `422`
- unhandled/internal -> `500`

### Logging policy

- log internal errors with stack/context
- do not leak stack traces in API responses
- always include `requestId` in error response envelope

## Observability Standard

### Logging

- structured JSON only
- fields required for request logs:
  - `ts`, `level`, `message`, `requestId`, `method`, `path`, `status`

### Tracing

- OpenTelemetry enabled by default (`OTEL_ENABLED=true`)
- exporter via OTLP env vars
- service name explicit (`OTEL_SERVICE_NAME`)

### Health endpoints

- `/health`: process alive
- `/ready`: dependency readiness (DB, critical external dependencies)

Do not collapse readiness into liveness.

## Performance and Resilience Guardrails

- Set explicit DB pool limits.
- Use timeouts/retries for external calls.
- Add idempotency key support for unsafe retriable write endpoints.
- Keep route handlers non-blocking; avoid CPU-heavy work in request thread.
- Introduce queue/worker only when latency or retries require it.

## Security Baseline

- Validate all input schemas.
- Default secure cookie/session settings in production.
- Never log secrets, tokens, raw credentials, or full auth headers.
- Keep auth, database, and telemetry secrets in env only.
- Add rate limiting for public auth-sensitive endpoints.

## Testing Contract

### Required test layers

1. Env config tests
   - invalid env fails fast
2. Route behavior tests
   - success + failure status paths
3. Auth tests
   - protected route unauthorized/authorized paths
4. Readiness tests
   - healthy and unhealthy dependency states

### When changing data/auth behavior

- add regression tests for the changed path
- include at least one negative scenario

No behavior change without tests unless explicitly approved.

## CI and Quality Gates

PR is not complete unless all pass:

- `bun run typecheck`
- `bun run test`

Recommended additions per service maturity:

- lint
- security audit
- migration check against ephemeral DB

## Change Management Rules

### Require ADR when changing

- framework (Elysia)
- auth provider
- DB/ORM strategy
- API versioning policy
- observability backbone

ADR must document:

- problem and alternatives
- migration strategy
- rollback strategy
- blast radius

## Agent Consistency Protocol

When an agent modifies architecture-sensitive code, it must:

1. reference this document in reasoning
2. keep module boundaries intact
3. update docs when behavior/contracts change
4. add/adjust tests before handoff
5. call out any intentional rule exceptions

## Anti-Patterns (Reject In Review)

Reject PRs that introduce:

- raw `any` data flowing across module boundaries
- route handlers with embedded SQL or long business logic
- new unversioned business endpoints
- schema changes without migrations
- auth checks done only in client code
- silent fallback defaults for required secrets
- undocumented behavior changes to public API payloads

## Review Checklist

Use this checklist before merge:

- route schemas complete and typed
- OpenAPI output reflects new/changed routes
- auth and authorization paths covered by tests
- migrations included and reversible path considered
- logs and traces include sufficient request context
- docs updated for any contract/config changes

## Decision Defaults for Future Features

When requirements are unclear, prefer:

- additive changes over breaking changes
- feature flags over hard switches for risky behavior
- explicit interfaces over implicit shared utilities
- smaller modules over large multi-responsibility files

## Living Document Policy

This document is authoritative and should evolve.
Any change to these rules must update this file in the same PR.
