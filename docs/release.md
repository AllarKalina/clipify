---
read_when:
  - shipping CLI updates
  - deploying backend
---

# Release and Deploy

## CLI Distribution (Homebrew-first)

1. Tag release as `clipify-cli-vX.Y.Z`.
2. GitHub Action `.github/workflows/release-cli.yml` builds macOS binary and publishes release asset.
3. Update Homebrew tap formula to point to new asset URL and SHA256.
4. Verify fresh install with `brew install allarkalina/tap/clipify`.

## API Deployment (Railway)

- Workflow: `.github/workflows/deploy-api.yml`
- Trigger: `main` changes under `apps/api/**` or manual dispatch
- Requirement: repo secret `RAILWAY_TOKEN`

## Minimum Release Gates

- `bun run typecheck`
- `bun run test`
- API compatibility metadata reflects current release strategy.
