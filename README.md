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
On first launch, use up/down arrows and Enter to choose `Sign up`, `Login`, or `Exit`.
After successful sign up/login, Spotify linking starts automatically (browser callback completion is detected in terminal).
After Spotify is linked, the terminal app displays your Spotify profile and now-playing state.
Press `d` in the authenticated shell to inspect Spotify Connect devices and transfer control to one without autoplay.

### Database Tools

```bash
# Generate migration SQL from schema changes
bun run --cwd apps/api db:generate

# Apply migrations to local DB
bun run --cwd apps/api db:migrate

# Open Drizzle Studio for local DB data browsing
bun run --cwd apps/api db:studio
```

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
- `GET /v1/spotify/me/player/devices`
- `GET /v1/spotify/me/player/currently-playing`
- `GET /v1/spotify/me/player/queue`
- `GET /v1/spotify/me/player/recently-played`
- `PUT /v1/spotify/me/player/transfer`
- `ALL /api/auth/*`

## Spotify OAuth Notes

- API exchanges OAuth code for access/refresh token at Spotify Accounts API.
- OAuth `state` is stored server-side as hashed one-time value with TTL (`spotify_oauth_state`).
- Linked tokens are stored encrypted in `spotify_connection`.
- OAuth scopes requested: `user-read-private user-read-email user-read-playback-state user-read-recently-played user-modify-playback-state playlist-read-private playlist-read-collaborative user-library-read`.
- Set Spotify app redirect URI to match `SPOTIFY_REDIRECT_URI` (default: `http://127.0.0.1:3000/v1/spotify/auth/callback/public`).
- Do not use `localhost` alias for Spotify redirect URI; use IP literal loopback (`127.0.0.1` or `::1`).
- `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET`, `SPOTIFY_REDIRECT_URI`, `SPOTIFY_TOKEN_ENCRYPTION_KEY` are required for Spotify routes.
- `SPOTIFY_TOKEN_ENCRYPTION_KEY` must be base64-encoded 32 bytes (`openssl rand -base64 32`).

### Spotify Troubleshooting

- `INVALID_CLIENT: Invalid redirect URI`
  - Ensure Spotify dashboard redirect URI and `SPOTIFY_REDIRECT_URI` match exactly.
  - Recommended local value: `http://127.0.0.1:3000/v1/spotify/auth/callback/public`.
- `SPOTIFY_TOKEN_ENCRYPTION_KEY must be base64-encoded 32 bytes`
  - Regenerate key and restart API.
- `GET /v1/spotify/me` returns `503`
  - One or more Spotify env vars are missing/empty.
- Home shows a re-link prompt after login
  - Older Spotify links may be missing the playlist/library scopes used by the current Home shell.
  - Press `l` in the authenticated shell to re-link and refresh permissions.

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
