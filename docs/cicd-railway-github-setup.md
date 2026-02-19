---
read_when:
  - setting up CI/CD for a new clone
  - debugging deploy pipeline failures
  - rotating Railway/GitHub deploy credentials
---

# CI/CD + Railway + GitHub Setup (Detailed)

Last updated: February 19, 2026

This document is the source of truth for how Clipify CI/CD is configured today:

1. what runs in GitHub Actions,
2. how Railway environments/services are mapped,
3. which GitHub environment variables/secrets are required,
4. how to verify and troubleshoot deployment failures.

## 1) Current Architecture

Repository: `AllarKalina/clipify`  
Default branch: `main`

Core pipeline shape:

1. CI (`.github/workflows/ci.yml`)
   - validates code quality and runtime smoke checks.
2. CD Dev (`.github/workflows/deploy-api-dev.yml`)
   - deploys API to Railway `dev`.
3. CD Preview (`.github/workflows/deploy-api-preview.yml`)
   - deploys API to Railway `preview` on PR updates.
4. CD Production (`.github/workflows/deploy-api-prod.yml`)
   - deploys API to Railway `production`.

## 2) GitHub Actions Setup

## CI Workflow

File: `.github/workflows/ci.yml`

Trigger:

1. `push` to `main` (except docs-only changes),
2. `pull_request` (except docs-only changes).

Jobs:

1. `validate`
   - `bun install --frozen-lockfile`
   - `bun run typecheck`
   - `bun run test`
2. `build`
   - builds CLI binary: `bun run build:cli`
3. `smoke-api`
   - starts ephemeral Postgres service in Actions,
   - runs migrations,
   - starts API,
   - runs `scripts/smoke-api.sh` against `http://localhost:3000`.

Concurrency:

1. `ci-${{ github.workflow }}-${{ github.ref }}`
2. `cancel-in-progress: true`

## CD Workflows

### Dev deploy

File: `.github/workflows/deploy-api-dev.yml`

Trigger:

1. `workflow_dispatch`
2. `push` to `main` when API/deploy files change.

Runtime steps:

1. install Bun + Node + Railway CLI
2. validate required env/secret presence
3. run migrations using `MIGRATION_DATABASE_URL`
4. deploy with `railway up apps/api --path-as-root ...`
5. smoke check deployed URL

### Preview deploy

File: `.github/workflows/deploy-api-preview.yml`

Trigger:

1. PR `opened`, `synchronize`, `reopened` on API/deploy path changes.

Same deploy steps as Dev, plus:

1. comments/updates PR with preview status and URL marker `<!-- clipify-preview -->`.

### Production deploy

File: `.github/workflows/deploy-api-prod.yml`

Trigger:

1. `workflow_dispatch`
2. `push` to `main` on API/deploy path changes.

Same deploy steps as Dev, pointed at `production` environment.

## 3) Railway Setup

Railway project:

1. name: `clipify`
2. project id: `0cf89390-b7ad-4622-99f7-98790e79ab83`

Services:

1. `clipify-api`
2. `Postgres`

Environments:

1. `dev`
2. `preview`
3. `production`

Public API domains:

1. `https://clipify-api-dev.up.railway.app`
2. `https://clipify-api-preview.up.railway.app`
3. `https://clipify-api-production.up.railway.app`

Important runtime note:

1. API service uses internal DB URL in Railway runtime (`postgres.railway.internal`).
2. GitHub Actions cannot resolve Railway internal DNS.
3. Therefore migrations in CI/CD must use public DB URL secret (`MIGRATION_DATABASE_URL`).

## 4) GitHub Repository Setup

## Environments

Required GitHub environments:

1. `dev`
2. `preview`
3. `production`

## Environment Variables (GitHub `vars`)

Set these per environment:

1. `RAILWAY_PROJECT_ID`
2. `RAILWAY_SERVICE_NAME`
3. `RAILWAY_ENVIRONMENT_NAME`
4. `API_BASE_URL`

Expected values:

1. `RAILWAY_PROJECT_ID=0cf89390-b7ad-4622-99f7-98790e79ab83`
2. `RAILWAY_SERVICE_NAME=clipify-api`
3. `RAILWAY_ENVIRONMENT_NAME` = matching env (`dev|preview|production`)
4. `API_BASE_URL` = matching public domain above

## Environment Secrets (GitHub `secrets`)

Set these per environment:

1. `RAILWAY_TOKEN`
2. `MIGRATION_DATABASE_URL`

`RAILWAY_TOKEN` requirements:

1. Use Railway project/environment token with deploy/migrate access.
2. Do not rely on local CLI session token.

`MIGRATION_DATABASE_URL` requirements:

1. Use Postgres public URL for that environment (not internal host).
2. Pull from Railway `Postgres` service `DATABASE_PUBLIC_URL`.

## Repository-level Secrets

Current design uses environment-scoped secrets for deploy jobs.
Repository-level `RAILWAY_TOKEN` is optional in this setup.

## 5) Local Development Setup (for parity)

Relevant files:

1. `docker-compose.yml`
2. `scripts/dev-up.sh`
3. `scripts/dev-down.sh`
4. `scripts/smoke-api.sh`

Main commands:

```bash
bun run dev:up
bun run dev:api
bun run dev:smoke
bun run dev:down
```

Port behavior:

1. local Postgres defaults to `5432`
2. if `5432` is busy, script auto-falls back to `5433`
3. script updates local `apps/api/.env` default DB URL when safe

## 6) Verification Checklist

After any CI/CD setup change:

1. `gh workflow run "Deploy API (Dev)" -R AllarKalina/clipify`
2. `gh run list -R AllarKalina/clipify --workflow "Deploy API (Dev)" --limit 1`
3. verify run result is `completed success`
4. hit smoke endpoints:
   - `/health`
   - `/ready`
   - `/v1/public/meta/version`

## 7) Troubleshooting

## Failure: Unauthorized Railway token

Symptom:

1. workflow fails in `Run migrations` with `Unauthorized`.

Fix:

1. rotate `RAILWAY_TOKEN` in each GitHub environment.
2. ensure token has access to Clipify project/environment.

## Failure: `postgres.railway.internal` DNS in GitHub Actions

Symptom:

1. migration fails with `ENOTFOUND postgres.railway.internal`.

Fix:

1. set/refresh `MIGRATION_DATABASE_URL` to `DATABASE_PUBLIC_URL` for that env.
2. keep workflow migration step using `DATABASE_URL="$MIGRATION_DATABASE_URL"`.

## Failure: API container boots with `Script not found "start"`

Symptom:

1. Railway logs show missing `start` script.

Fix:

1. ensure `apps/api/Dockerfile` runner stage includes `COPY package.json ./package.json`.

## 8) Operational Constraints

1. Production required-reviewer environment rule may be unavailable on current GitHub plan.
2. If unavailable, use manual `workflow_dispatch` + branch protection/process controls.
3. Keep deploy workflows and this doc in sync on every pipeline change.
