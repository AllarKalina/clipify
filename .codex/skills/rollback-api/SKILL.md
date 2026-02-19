# Rollback API Skill

Purpose: restore API availability quickly after a bad deployment.

## Read First

1. `docs/cicd-railway-github-setup.md`
2. `docs/release.md`
3. `docs/operations.md`

## Procedure

1. Identify failing deployment:
   - `gh run list -R AllarKalina/clipify --workflow "Deploy API (Dev)" --limit 5`
2. Check Railway deploy history/logs:
   - `railway deployments --environment <env> --service clipify-api`
   - `railway logs --environment <env> --service clipify-api`
3. Redeploy previous healthy deployment in Railway dashboard or CLI.
4. Re-run smoke checks:
   - `bash scripts/smoke-api.sh <base-url>`
5. If migration-related, apply forward-fix migration and redeploy.

## Exit Criteria

1. Smoke checks pass.
2. Incident summary is recorded in PR/release notes.
