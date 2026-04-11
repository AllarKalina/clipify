---
read_when:
  - creating railway environments
  - configuring deploy secrets
  - investigating failed deployments
  - debugging local spotify auth/login issues
---

# Operations Runbook

## Railway Project Bootstrap

Target project:

1. Project name: `clipify`
2. Services: `clipify-api`, `Postgres`
3. Environments: `dev`, `preview`, `production`

Bootstrap steps:

1. `railway link --project <project-id>`
2. `railway add --database postgres`
3. `railway add --service clipify-api`
4. `railway environment new dev`
5. `railway environment new preview`
6. `railway environment new production`

## Required Railway Variables (`clipify-api` service)

For each environment, set:

1. `NODE_ENV`
2. `APP_NAME`
3. `API_VERSION`
4. `MIN_CLI_VERSION`
5. `LATEST_CLI_VERSION`
6. `HOST`
7. `PORT`
8. `DATABASE_URL`
9. `BETTER_AUTH_SECRET`
10. `BETTER_AUTH_URL`
11. `SPOTIFY_CLIENT_ID`
12. `SPOTIFY_CLIENT_SECRET`
13. `SPOTIFY_REDIRECT_URI`
14. `SPOTIFY_TOKEN_ENCRYPTION_KEY`
15. `OTEL_ENABLED`
16. `OTEL_SERVICE_NAME`
17. `OTEL_EXPORTER_OTLP_ENDPOINT`
18. `OTEL_EXPORTER_OTLP_HEADERS`

## GitHub Environment Setup

Create environments:

1. `dev`
2. `preview`
3. `production` (require manual approval reviewers)

Set variables in each environment:

1. `RAILWAY_PROJECT_ID`
2. `RAILWAY_SERVICE_NAME` (`clipify-api`)
3. `RAILWAY_ENVIRONMENT_NAME`
4. `API_BASE_URL`

Set repository secret:

1. `RAILWAY_TOKEN`

## Deployment Verification

After each deploy, verify:

1. `GET /health` returns success.
2. `GET /ready` returns success.
3. `GET /v1/public/meta/version` returns metadata keys.

Manual command:

```bash
bash scripts/smoke-api.sh <base-url>
```

## Failure Triage

1. Check GitHub Action logs (`validate deploy config`, `migrate`, `deploy`, `smoke`).
2. Inspect Railway deploy logs:
   - `railway logs --service clipify-api --environment <env>`
3. Verify environment variables:
   - `railway variable --service clipify-api --environment <env>`
4. Re-run migrations manually if needed:
   - `railway run --service clipify-api --environment <env> -- bun run --cwd apps/api db:migrate`

## Local Spotify Auth Checklist

1. Confirm local API env contains:
   - `SPOTIFY_CLIENT_ID`
   - `SPOTIFY_CLIENT_SECRET`
   - `SPOTIFY_REDIRECT_URI`
   - `SPOTIFY_TOKEN_ENCRYPTION_KEY`
2. Use loopback IP literal redirect URI locally:
   - `http://127.0.0.1:3000/v1/cli/auth/callback/public`
3. Set the same exact redirect URI in Spotify Developer Dashboard app settings.
4. Generate valid token encryption key:
   - `openssl rand -base64 32`
5. Restart local API after env changes:
   - `bun run dev:api`

## Local Spotify Error Map

1. `INVALID_CLIENT: Invalid redirect URI`
   - Dashboard URI and `SPOTIFY_REDIRECT_URI` do not match exactly.
2. `SPOTIFY_TOKEN_ENCRYPTION_KEY must be base64-encoded 32 bytes`
   - Invalid key format/length.
3. `GET /v1/cli/bootstrap` returns `503`
   - Spotify env is incomplete.
