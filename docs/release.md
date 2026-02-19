---
read_when:
  - shipping CLI updates
  - deploying backend
  - setting CI/CD requirements
---

# Release and Deploy

## CI Gate

Required checks before merge:

1. `validate` (`bun run typecheck`, `bun run test`)
2. `build` (CLI binary build sanity)
3. `smoke-api` (migrations + API boot + smoke endpoints)

## CLI Distribution (Homebrew-first)

1. Tag release as `clipify-cli-vX.Y.Z`.
2. GitHub Action `.github/workflows/release-cli.yml` builds macOS binary and publishes release asset.
3. Update Homebrew tap formula to point to new asset URL and SHA256.
4. Verify fresh install with `brew install allarkalina/tap/clipify`.

## API Deployment (Railway, GitHub Actions Driven)

### Workflows

1. `.github/workflows/deploy-api-preview.yml`
   - Trigger: pull requests touching API deployment paths
   - Target: Railway `preview` environment
2. `.github/workflows/deploy-api-dev.yml`
   - Trigger: `main` changes touching API deployment paths
   - Target: Railway `dev` environment
3. `.github/workflows/deploy-api-prod.yml`
   - Trigger: `main` changes and manual dispatch
   - Target: Railway `production` environment
   - Requires GitHub environment approval gate

### Deploy sequence

1. Validate deploy config vars/secrets.
2. Run DB migrations through `railway run ... bun run --cwd apps/api db:migrate`.
3. Deploy API through `railway up apps/api --path-as-root ...`.
4. Run smoke checks with `scripts/smoke-api.sh` against environment base URL.

### Required GitHub configuration

Repo secrets:

1. `RAILWAY_TOKEN`

Environment variables (`dev`, `preview`, `production`):

1. `RAILWAY_PROJECT_ID`
2. `RAILWAY_SERVICE_NAME`
3. `RAILWAY_ENVIRONMENT_NAME`
4. `API_BASE_URL`

### Runtime secret source

Application secrets (auth, Spotify, DB URL) should live in Railway environment variables,
not in repository secrets.

## Rollback

If production deploy fails after rollout:

1. In Railway, redeploy the previous healthy API deployment.
2. Re-run smoke checks against production base URL.
3. If failure was migration-related, apply a forward-fix migration and redeploy.
4. Record incident details in PR/release notes.
