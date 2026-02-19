#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
API_DIR="$ROOT_DIR/apps/api"
ENV_FILE="$API_DIR/.env"
ENV_EXAMPLE="$API_DIR/.env.example"
POSTGRES_PORT="${CLIPIFY_POSTGRES_PORT:-5432}"

port_is_busy() {
  local port="$1"
  if command -v lsof >/dev/null 2>&1; then
    lsof -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1
    return
  fi
  return 1
}

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker is required but was not found on PATH."
  exit 1
fi

if [[ -z "${CLIPIFY_POSTGRES_PORT:-}" ]] && port_is_busy "$POSTGRES_PORT"; then
  POSTGRES_PORT=5433
  echo "Port 5432 is busy; falling back to CLIPIFY_POSTGRES_PORT=$POSTGRES_PORT"
fi

export CLIPIFY_POSTGRES_PORT="$POSTGRES_PORT"

echo "Starting local dependencies..."
docker compose -f "$ROOT_DIR/docker-compose.yml" up -d postgres

echo "Waiting for Postgres to become healthy..."
for _ in {1..40}; do
  if docker compose -f "$ROOT_DIR/docker-compose.yml" exec -T postgres pg_isready -U postgres -d bun_template >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

if ! docker compose -f "$ROOT_DIR/docker-compose.yml" exec -T postgres pg_isready -U postgres -d bun_template >/dev/null 2>&1; then
  echo "Postgres did not become healthy in time."
  exit 1
fi

if [[ ! -f "$ENV_FILE" ]]; then
  cp "$ENV_EXAMPLE" "$ENV_FILE"
  echo "Created apps/api/.env from .env.example"
fi

if [[ "$POSTGRES_PORT" != "5432" ]]; then
  if grep -q "localhost:5432/bun_template" "$ENV_FILE"; then
    sed -i.bak "s/localhost:5432\\/bun_template/localhost:${POSTGRES_PORT}\\/bun_template/" "$ENV_FILE"
    rm -f "$ENV_FILE.bak"
    echo "Updated apps/api/.env DATABASE_URL to use localhost:${POSTGRES_PORT}"
  else
    echo "Using custom Postgres port ${POSTGRES_PORT}; verify DATABASE_URL in apps/api/.env points to localhost:${POSTGRES_PORT}."
  fi
fi

echo "Installing dependencies..."
bun install

echo "Running API migrations..."
bun run --cwd "$API_DIR" db:migrate

echo "Local backend setup is ready."
echo "Next: bun run dev:api"
