# Release CLI Skill

Purpose: ship Clipify terminal binary release consistently.

## Read First

1. `docs/release.md`
2. `README.md`

## Preconditions

1. `bun run typecheck` passes.
2. `bun run test` passes.
3. CLI changes are merged to `main`.

## Procedure

1. Create release tag:
   - `git tag clipify-cli-vX.Y.Z`
   - `git push origin clipify-cli-vX.Y.Z`
2. Verify workflow:
   - `.github/workflows/release-cli.yml`
3. Monitor release run:
   - `gh run list -R AllarKalina/clipify --workflow "Release CLI" --limit 1`
4. Confirm artifact attached to GitHub release.
5. Update Homebrew tap formula URL + SHA.

## Post-Release Verification

1. Install fresh:
   - `brew install allarkalina/tap/clipify`
2. Run binary and confirm app starts.
