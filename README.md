# bun-backend-template

Bun backend template with Elysia, Drizzle, Better Auth, OpenAPI, and OpenTelemetry.

## Stack

- Bun runtime + package manager + test runner
- Elysia API framework
- Zod env validation
- Postgres + Drizzle ORM + SQL migrations
- Better Auth (email/password + session)
- OpenAPI via `@elysiajs/openapi`
- OpenTelemetry via `@elysiajs/opentelemetry`

## Quickstart

```bash
bun install
cp .env.example .env
bun run start
```

## Scripts

- `bun run dev` watch mode
- `bun run start` run server once
- `bun run test` run tests
- `bun run typecheck` run TypeScript checks
- `bun run db:generate` generate migrations from schema
- `bun run db:migrate` apply migrations

## Routes

- `GET /health` liveness
- `GET /ready` readiness (checks DB)
- `GET /v1/public/example` public hard-coded sample payload
- `GET /v1/me` protected profile route
- `ALL /api/auth/*` Better Auth routes
- `GET /openapi` docs UI (development only)
- `GET /openapi/json` OpenAPI JSON (all envs)

## Environment

Required variables are validated at boot in `src/config/env.ts`.
Use `.env.example` as source of truth.

## Auth Notes

- Base scaffold enables email/password auth.
- Better Auth tables are defined in `src/db/schema.ts`.
- Run migrations before auth flows.

## Project layout

```text
src/
  app.ts
  server.ts
  config/env.ts
  db/client.ts
  db/schema.ts
  modules/
  plugins/
migrations/
  0000_initial_auth.sql
test/
  app.test.ts
  env.test.ts
```

## Docker

```bash
docker build -t bun-backend-template .
docker run --env-file .env -p 3000:3000 bun-backend-template
```

## CI

GitHub Actions workflow at `.github/workflows/ci.yml` runs:

- `bun run typecheck`
- `bun run test`

## Architecture Standard

Use `docs/backend-architecture-standard.md` as the source of truth for module design, API modeling, testing, and review consistency across agent iterations.
