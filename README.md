# clipify

Spotify CLI + hosted backend monorepo, built on Bun.

## Workspace

- `apps/api`: Elysia backend, auth, DB, Spotify integration layer
- `apps/cli`: user-facing terminal binary
- `packages/api-client`: typed HTTP client used by CLI
- `packages/tsconfig`: shared TypeScript base config

## Commands

```bash
bun install
bun run typecheck
bun run test
```

### API

```bash
cp apps/api/.env.example apps/api/.env
bun run --cwd apps/api db:migrate
bun --cwd apps/api run dev
```

### CLI

```bash
bun --cwd apps/cli run start -- doctor --api http://localhost:3000
```

## API Routes (current)

- `GET /health`
- `GET /ready`
- `GET /v1/public/example`
- `GET /v1/public/meta/version`
- `GET /v1/me`
- `GET /v1/spotify/auth/start`
- `GET /v1/spotify/auth/callback`
- `GET /v1/spotify/me/player/currently-playing`
- `ALL /api/auth/*`

## Spotify OAuth Notes

- API exchanges OAuth code for access/refresh token at Spotify Accounts API.
- Linked tokens are stored in `spotify_connection` table.
- `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET`, `SPOTIFY_REDIRECT_URI` are required for Spotify routes.

## Release + Deploy

- CLI release workflow: `.github/workflows/release-cli.yml`
- API deploy workflow: `.github/workflows/deploy-api.yml` (Railway)
- CI workflow: `.github/workflows/ci.yml`

## Architecture

- Backend standards: `docs/backend-architecture-standard.md`
- Monorepo architecture: `docs/architecture.md`
- API compatibility policy: `docs/api-compatibility.md`
- Release/deploy notes: `docs/release.md`
