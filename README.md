# clipify

Spotify terminal app + hosted backend monorepo, built on Bun.

## Workspace

- `apps/api`: Elysia backend, auth, DB, Spotify integration layer
- `apps/cli`: user-facing terminal app
- `packages/api-client`: typed HTTP client used by terminal app
- `packages/tsconfig`: shared TypeScript base config

## Commands

```bash
bun install
bun run dev:up
bun run dev:api
```

```bash
bun run typecheck
bun run test
bun run build:cli
```

### Local Development

```bash
# Start local Postgres + install deps + run migrations
bun run dev:up

# Start backend API
bun run dev:api

# Run smoke checks (health + readiness + version metadata)
bun run dev:smoke

# Stop local dependencies
bun run dev:down
```

### Terminal App

```bash
# Launch interactive terminal app
bun --cwd apps/cli run start -- --api http://localhost:3000

```

The terminal app connects to backend APIs for user/session and Spotify status.
On first launch, press `l` to login with email/password. After login, press `l` again to start Spotify linking (browser callback completion is detected automatically).
After Spotify is linked, the terminal app displays your Spotify profile and now-playing state.

## API Routes (current)

- `GET /health`
- `GET /ready`
- `GET /v1/public/example`
- `GET /v1/public/meta/version`
- `GET /v1/me`
- `GET /v1/spotify/auth/start`
- `GET /v1/spotify/auth/status`
- `GET /v1/spotify/auth/callback`
- `GET /v1/spotify/auth/callback/public`
- `GET /v1/spotify/me`
- `GET /v1/spotify/me/player/currently-playing`
- `ALL /api/auth/*`

## Spotify OAuth Notes

- API exchanges OAuth code for access/refresh token at Spotify Accounts API.
- OAuth `state` is stored server-side as hashed one-time value with TTL (`spotify_oauth_state`).
- Linked tokens are stored encrypted in `spotify_connection`.
- OAuth scopes requested: `user-read-private user-read-email user-read-playback-state`.
- Set Spotify app redirect URI to match `SPOTIFY_REDIRECT_URI` (default: `http://127.0.0.1:3000/v1/spotify/auth/callback/public`).
- Do not use `localhost` alias for Spotify redirect URI; use IP literal loopback (`127.0.0.1` or `::1`).
- `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET`, `SPOTIFY_REDIRECT_URI`, `SPOTIFY_TOKEN_ENCRYPTION_KEY` are required for Spotify routes.

## Release + Deploy

- CLI release workflow: `.github/workflows/release-cli.yml`
- API dev deploy workflow: `.github/workflows/deploy-api-dev.yml` (Railway)
- API preview deploy workflow: `.github/workflows/deploy-api-preview.yml` (Railway)
- API production deploy workflow: `.github/workflows/deploy-api-prod.yml` (Railway, manual approval)
- CI workflow: `.github/workflows/ci.yml`

## Architecture

- Backend standards: `docs/backend-architecture-standard.md`
- Monorepo architecture: `docs/architecture.md`
- API compatibility policy: `docs/api-compatibility.md`
- Release/deploy notes: `docs/release.md`
