#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEPLOY_ROOT="${1:-${REPO_ROOT}/.railway-api-deploy}"

rm -rf "$DEPLOY_ROOT"
mkdir -p "$DEPLOY_ROOT/apps" "$DEPLOY_ROOT/packages"

cp "$REPO_ROOT/package.json" "$DEPLOY_ROOT/package.json"
cp "$REPO_ROOT/bun.lock" "$DEPLOY_ROOT/bun.lock"
cp "$REPO_ROOT/apps/api/Dockerfile" "$DEPLOY_ROOT/Dockerfile"

mkdir -p "$DEPLOY_ROOT/apps/api"
cp -R "$REPO_ROOT/apps/api/src" "$DEPLOY_ROOT/apps/api/src"
cp "$REPO_ROOT/apps/api/package.json" "$DEPLOY_ROOT/apps/api/package.json"

mkdir -p "$DEPLOY_ROOT/apps/cli"
cp "$REPO_ROOT/apps/cli/package.json" "$DEPLOY_ROOT/apps/cli/package.json"

mkdir -p "$DEPLOY_ROOT/packages/api-client"
cp "$REPO_ROOT/packages/api-client/package.json" "$DEPLOY_ROOT/packages/api-client/package.json"

mkdir -p "$DEPLOY_ROOT/packages/contracts"
cp "$REPO_ROOT/packages/contracts/package.json" "$DEPLOY_ROOT/packages/contracts/package.json"
cp -R "$REPO_ROOT/packages/contracts/src" "$DEPLOY_ROOT/packages/contracts/src"

echo "Prepared Railway deploy context: $DEPLOY_ROOT"
