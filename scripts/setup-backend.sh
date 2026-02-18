#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
API_DIR="$ROOT_DIR/apps/api"
ENV_FILE="$API_DIR/.env"
ENV_EXAMPLE="$API_DIR/.env.example"

if [[ ! -f "$ENV_FILE" ]]; then
  cp "$ENV_EXAMPLE" "$ENV_FILE"
  echo "Created apps/api/.env from .env.example"
  echo "Review apps/api/.env before production use."
else
  echo "Using existing apps/api/.env"
fi

echo "Running API migrations..."
if ! bun run --cwd "$API_DIR" db:migrate; then
  echo ""
  echo "Migration failed."
  echo "Check DATABASE_URL in apps/api/.env and confirm Postgres is reachable."
  echo "Example local URL: postgres://postgres:postgres@localhost:5432/bun_template"
  exit 1
fi

echo "Backend setup complete."
echo "Next: bun run dev:api"
