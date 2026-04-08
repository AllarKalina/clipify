---
read_when:
  - resuming local Clipify development in a future agent session
  - bootstrapping local api + tui workflow
  - diagnosing why local dev startup worked previously but fails now
---

# Local Dev Agent Handoff

Canonical local resume note for future agent sessions.
Use this after opening `docs/INDEX.md`.

## Verified Local Flow

As of 2026-04-08, the local development loop was verified end-to-end:

1. Start Docker via Colima.
2. Run `bun run dev:up`.
3. Run `bun run dev:api`.
4. Launch CLI with `bun run --cwd apps/cli start -- --api http://127.0.0.1:3000`.
5. Exercise auth flow in the TUI.
6. Confirm API health and metadata endpoints respond.

## Startup Sequence

From repo root:

```bash
colima start
bun run dev:up
bun run dev:api
```

In another terminal:

```bash
bun run --cwd apps/cli start -- --api http://127.0.0.1:3000
```

For CLI code iteration:

```bash
bun run --cwd apps/cli dev
```

Notes:

1. `apps/cli dev` now uses Bun `--watch` for stable full-process restarts during TUI work.
2. `apps/cli dev:hot` exists as an experimental faster loop, but raw-mode/input state can get weird in terminal apps, so prefer `dev` by default.

## Health Checks

Verify backend:

```bash
curl -sf http://127.0.0.1:3000/health
curl -sf http://127.0.0.1:3000/v1/public/meta/version
```

Expected results:

1. `/health` returns JSON with `status: "ok"`.
2. `/v1/public/meta/version` returns app/api/CLI compatibility metadata.

## Local TUI Checks

Known-good TUI paths:

1. Unauthenticated landing screen renders centered `Sign up / Login / Exit`.
2. Arrow keys move selection.
3. `Esc` cancels inline auth input and returns to the menu.
4. Sign up flow transitions to authenticated dashboard.
5. If Spotify is already linked, login lands directly on dashboard.
6. If Spotify is not linked, signup/login starts the browser-based Spotify link flow.

## Known Local Pitfalls

### Colima not running

Symptom:

- `docker` cannot connect to `unix:///Users/allarkalina/.config/colima/default/docker.sock`

Fix:

```bash
colima start
```

### Stale Colima VM state

Observed once on 2026-04-08.

Symptom:

- `colima start` fails with `failed to run attach disk "colima", in use by instance "colima"`

Fix:

```bash
colima stop --force
colima start
```

### API env points at wrong Postgres port

Observed once on 2026-04-08.

Symptom:

- migrations fail with `ECONNREFUSED`
- Postgres is healthy, but [`apps/api/.env`](/Users/allarkalina/git/clipify/apps/api/.env) points to `localhost:5433`

Fix:

1. Check Docker port mapping in [`docker-compose.yml`](/Users/allarkalina/git/clipify/docker-compose.yml).
2. Ensure `DATABASE_URL` in [`apps/api/.env`](/Users/allarkalina/git/clipify/apps/api/.env) matches the active mapped port.
3. Re-run:

```bash
bun run --cwd apps/api db:migrate
```

## Session Notes

Local API was verified on `http://127.0.0.1:3000`.

Local TUI was verified with live PTY interaction, including:

1. signup path for a fresh test account
2. login path for an existing account
3. authenticated dashboard render
4. Spotify-linked account path

## Practical Resume Rule

If a future session needs to "continue working on Clipify", do this first:

1. read `docs/INDEX.md`
2. read this file
3. run `colima start`
4. run `bun run dev:up`
5. run `bun run dev:api`
6. launch the CLI TUI
