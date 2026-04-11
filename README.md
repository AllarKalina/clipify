# clipify

Spotify terminal app + hosted backend monorepo, built on Bun.

## Workspace

- `apps/api`: Elysia backend, auth, DB, Spotify integration layer
- `apps/cli`: user-facing terminal app
- `packages/api-client`: typed HTTP client used by terminal app
- `packages/contracts`: shared API contracts for api + client
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
bun run docs:list
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
CLI-facing API errors are normalized as `{ error: { code, message, hint? } }` envelopes.

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
- `GET /v1/public/meta/version`
- `GET /v1/me`
- `GET /v1/cli/auth/start`
- `GET /v1/cli/auth/status`
- `GET /v1/cli/auth/callback/public`
- `GET /v1/cli/bootstrap`
- `GET /v1/cli/player/snapshot`
- `GET /v1/cli/view/library/:libraryId`
- `GET /v1/cli/search`
- `GET /v1/cli/devices`
- `POST /v1/cli/player/action`
- `POST /api/auth/sign-in/email`
- `POST /api/auth/sign-up/email`
- `POST /api/auth/sign-out`

Auth routes are explicit typed Elysia endpoints that delegate to Better Auth `auth.api` handlers.
Rate limiting is enabled on auth routes and `/v1/cli/search`.

## Spotify OAuth Notes

- API exchanges OAuth code for access/refresh token at Spotify Accounts API.
- OAuth `state` is stored server-side as hashed one-time value with TTL (`spotify_oauth_state`).
- Linked tokens are stored encrypted in `spotify_connection`.
- OAuth scopes requested: `user-read-private user-read-email user-read-playback-state user-read-recently-played user-modify-playback-state playlist-read-private playlist-read-collaborative user-library-read`.
- Set Spotify app redirect URI to match `SPOTIFY_REDIRECT_URI` (canonical default: `http://127.0.0.1:3000/v1/cli/auth/callback/public`).
- Do not use `localhost` alias for Spotify redirect URI; use IP literal loopback (`127.0.0.1` or `::1`).
- `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET`, `SPOTIFY_REDIRECT_URI`, `SPOTIFY_TOKEN_ENCRYPTION_KEY` are required for CLI Spotify integration routes.
- `SPOTIFY_TOKEN_ENCRYPTION_KEY` must be base64-encoded 32 bytes (`openssl rand -base64 32`).

### Spotify Troubleshooting

- `INVALID_CLIENT: Invalid redirect URI`
  - Ensure Spotify dashboard redirect URI and `SPOTIFY_REDIRECT_URI` match exactly.
  - Recommended local value: `http://127.0.0.1:3000/v1/cli/auth/callback/public`.
- OAuth callback `NOT_FOUND`
  - Ensure the Spotify app uses `http://127.0.0.1:3000/v1/cli/auth/callback/public`.
- `SPOTIFY_TOKEN_ENCRYPTION_KEY must be base64-encoded 32 bytes`
  - Regenerate key and restart API.
- `GET /v1/cli/bootstrap` returns `503`
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
- API evolution policy (development): `docs/api-compatibility.md`
- Release/deploy notes: `docs/release.md`
