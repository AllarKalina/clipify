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
bun --cwd apps/cli run start -- spotify-login --cookie "better-auth.session_token=<token>"
bun --cwd apps/cli run start -- spotify-login --complete-url "http://localhost:3000/v1/spotify/auth/callback?code=<code>&state=<state>" --cookie "better-auth.session_token=<token>"
bun --cwd apps/cli run start -- spotify-auth-start --cookie "better-auth.session_token=<token>"
bun --cwd apps/cli run start -- spotify-auth-callback --code "<code>" --state "<state>" --cookie "better-auth.session_token=<token>"
bun --cwd apps/cli run start -- spotify-now-playing --cookie "better-auth.session_token=<token>"
bun --cwd apps/cli run start -- spotify-status --cookie "better-auth.session_token=<token>"
bun --cwd apps/cli run start -- auth-set-cookie --cookie "better-auth.session_token=<token>"
bun --cwd apps/cli run start -- auth-clear-cookie
```

Protected CLI routes require an authenticated session cookie in `--cookie` or `CLIPIFY_SESSION_COOKIE`.
You can persist a session cookie locally with `auth-set-cookie` (stored in `~/.config/clipify/config.json` by default, or `$XDG_CONFIG_HOME/clipify/config.json`).

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
- OAuth `state` is stored server-side as hashed one-time value with TTL (`spotify_oauth_state`).
- Linked tokens are stored encrypted in `spotify_connection`.
- `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET`, `SPOTIFY_REDIRECT_URI`, `SPOTIFY_TOKEN_ENCRYPTION_KEY` are required for Spotify routes.

## Release + Deploy

- CLI release workflow: `.github/workflows/release-cli.yml`
- API deploy workflow: `.github/workflows/deploy-api.yml` (Railway)
- CI workflow: `.github/workflows/ci.yml`

## Architecture

- Backend standards: `docs/backend-architecture-standard.md`
- Monorepo architecture: `docs/architecture.md`
- API compatibility policy: `docs/api-compatibility.md`
- Release/deploy notes: `docs/release.md`
