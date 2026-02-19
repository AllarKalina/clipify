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
echo "API smoke checks passed."
