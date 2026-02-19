# Deploy API Skill

Purpose: consistently deploy Clipify API through the existing GitHub/Railway pipeline.

## Read First

1. `docs/cicd-railway-github-setup.md`
2. `docs/release.md`

## Preconditions

1. Branch contains desired API changes.
2. CI checks passed (`validate`, `build`, `smoke-api`).
3. Required GitHub env vars/secrets exist for target environment.

## Procedure

1. For dev deployment, run:
   - `gh workflow run "Deploy API (Dev)" -R AllarKalina/clipify`
2. For production deployment, run:
   - `gh workflow run "Deploy API (Production)" -R AllarKalina/clipify`
3. Track run:
   - `gh run list -R AllarKalina/clipify --workflow "<workflow name>" --limit 1`
4. On success, verify:
   - `/health`
   - `/ready`
   - `/v1/public/meta/version`

## Failure Handling

1. Pull failed logs:
   - `gh run view <run-id> -R AllarKalina/clipify --log-failed`
2. Follow troubleshooting in:
   - `docs/cicd-railway-github-setup.md`
