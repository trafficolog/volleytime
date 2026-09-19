#!/usr/bin/env bash
set -euo pipefail

ROOT="${VOLLEYTIME_ROOT:-/opt/volleytime}"
COMPOSE=(docker compose -f docker-compose.prod.yml --env-file .env)
BUNDLE_TO_REMOVE=""

cleanup_bundle() {
  if [ -n "$BUNDLE_TO_REMOVE" ]; then
    rm -f -- "$BUNDLE_TO_REMOVE"
  fi
}

cd "$ROOT"
install -d -m 700 .deploy
test -f .env

deploy_bundle() {
  local bundle="${1:-}" expected_sha="${2:-}" previous_sha

  test -n "$bundle"
  test -f "$bundle"
  [[ "$expected_sha" =~ ^[0-9a-fA-F]{40}$ ]]
  test -f .deploy/scripts/release-bundle.mjs

  node .deploy/scripts/release-bundle.mjs verify \
    --repo "$ROOT" --bundle "$bundle" --expected "$expected_sha"

  previous_sha="$(git rev-parse HEAD)"
  printf '%s\n' "$previous_sha" > .deploy/previous-git-sha
  chmod 600 .deploy/previous-git-sha

  BUNDLE_TO_REMOVE="$bundle"
  trap cleanup_bundle EXIT

  bash .deploy/scripts/backup-local.sh

  node .deploy/scripts/release-bundle.mjs advance \
    --repo "$ROOT" --bundle "$bundle" --expected "$expected_sha"

  # Build all application images on the VPS. Postgres/Caddy stay upstream images.
  "${COMPOSE[@]}" build migrate web bot

  # Database migrations are forward-only in production and run before app restart.
  "${COMPOSE[@]}" run --rm migrate
  "${COMPOSE[@]}" up -d
  docker image prune -f
}

rollback() {
  test -s .deploy/previous-git-sha
  local previous_sha current_sha
  previous_sha="$(cat .deploy/previous-git-sha)"
  current_sha="$(git rev-parse HEAD)"

  if [ "$previous_sha" = "$current_sha" ]; then
    echo "previous revision equals current revision; rollback refused" >&2
    exit 1
  fi

  git cat-file -e "$previous_sha^{commit}"
  printf '%s\n' "$current_sha" > .deploy/failed-git-sha
  chmod 600 .deploy/failed-git-sha

  # Do not reverse database migrations here. R0 production migrations must remain
  # forward-compatible with the previous application revision.
  git reset --hard "$previous_sha"
  "${COMPOSE[@]}" build web bot
  "${COMPOSE[@]}" up -d web bot caddy
  docker image prune -f

  echo "local-build rollback completed: $current_sha -> $previous_sha"
}

case "${1:-}" in
  deploy-bundle)
    deploy_bundle "${2:-}" "${3:-}"
    ;;
  rollback)
    rollback
    ;;
  *)
    echo "usage: $0 {deploy-bundle BUNDLE EXPECTED_SHA|rollback}" >&2
    exit 2
    ;;
esac
