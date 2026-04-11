#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${1:-http://localhost:3000}"

check_endpoint() {
  local path="$1"
  local url="${BASE_URL}${path}"
  if ! curl -fsS "$url" >/dev/null; then
    echo "Smoke check failed: $url"
    exit 1
  fi
  echo "OK $url"
}

check_status() {
  local path="$1"
  local expected_status="$2"
  local url="${BASE_URL}${path}"
  local status
  status="$(curl -sS -o /dev/null -w "%{http_code}" "$url")"

  if [[ "$status" != "$expected_status" ]]; then
    echo "Smoke check failed: $url expected HTTP $expected_status, got $status"
    exit 1
  fi

  echo "OK $url (HTTP $expected_status)"
}

check_endpoint "/health"
check_endpoint "/ready"

VERSION_RESPONSE="$(curl -fsS "${BASE_URL}/v1/public/meta/version")"
for required_key in appName apiVersion minCliVersion latestCliVersion; do
  if [[ "$VERSION_RESPONSE" != *"\"${required_key}\""* ]]; then
    echo "Smoke check failed: /v1/public/meta/version missing key ${required_key}"
    exit 1
  fi
done

echo "OK ${BASE_URL}/v1/public/meta/version"
check_status "/v1/cli/bootstrap" "401"
echo "API smoke checks passed."
