#!/usr/bin/env bash
set -euo pipefail

ROOT="${VOLLEYTIME_ROOT:-/opt/volleytime}"
COMPOSE=(docker compose -f docker-compose.prod.yml --env-file .env)

cd "$ROOT"
install -d -m 700 .deploy
test -f .env

deploy() {
  local previous_sha
  previous_sha="$(git rev-parse HEAD)"
  printf '%s\n' "$previous_sha" > .deploy/previous-git-sha
  chmod 600 .deploy/previous-git-sha

  git fetch origin prod
  git checkout prod
  git pull --ff-only origin prod

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
  deploy)
    deploy
    ;;
  rollback)
    rollback
    ;;
  *)
    echo "usage: $0 {deploy|rollback}" >&2
    exit 2
    ;;
esac
