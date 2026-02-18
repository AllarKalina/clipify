# Bun Backend Template: Ecosystem Plan

Date: 2026-02-18

## Goal

Pragmatic backend template for future projects.
Priorities: fast start, low maintenance, easy scale-up, Bun-native first.

## Final Decisions

- HTTP framework: Elysia
- Validation: full route schemas + OpenAPI
- Database: Postgres + Drizzle ORM
- Auth: Better Auth (`email/password + session`)
- Observability: JSON logs + request ID + OpenTelemetry (OTLP HTTP via env)
- Jobs/queues: not included by default
- Deployment baseline: Docker + GitHub Actions (`typecheck`, `test`)

## OpenAPI Policy

- Development: UI at `/openapi` and JSON at `/openapi/json`
- Production: JSON at `/openapi/json` only

## Why this stack

- Bun-native with strong DX for API-heavy apps
- Typed contracts from route schemas
- Auth included from day one for app products
- Vendor-neutral telemetry path

## Extension Tracks

- Add Redis queue (`bullmq`) only for retries/scheduling workloads
- Add OAuth providers in Better Auth per project needs
- Add framework-specific presets only when team requests

## Sources

- Bun docs: https://bun.sh/docs
- Elysia docs: https://elysiajs.com/
- Elysia OpenAPI plugin: https://elysiajs.com/plugins/openapi
- Elysia OpenTelemetry plugin: https://elysiajs.com/plugins/opentelemetry
- Drizzle docs: https://orm.drizzle.team/
- Better Auth docs: https://www.better-auth.com/docs
