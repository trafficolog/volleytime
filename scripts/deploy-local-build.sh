#!/usr/bin/env bash
set -euo pipefail

ROOT="${VOLLEYTIME_ROOT:-/opt/volleytime}"
COMPOSE=(docker compose -f docker-compose.prod.yml --env-file .env --env-file .env.images)
BUNDLE_TO_REMOVE=""

cleanup_bundle() {
  if [ -n "$BUNDLE_TO_REMOVE" ]; then
    rm -f -- "$BUNDLE_TO_REMOVE"
  fi
}

install_release_manifest() {
  local expected_sha="$1" previous_sha="$2"
  local candidate_manifest=".deploy/.env.images.candidate"

  umask 077
  cat > "$candidate_manifest" <<EOF
WEB_IMAGE=volleytime-web:${expected_sha}
BOT_IMAGE=volleytime-bot:${expected_sha}
MIGRATOR_IMAGE=volleytime-migrator:${expected_sha}
RELEASE_VERSION=${expected_sha}
EOF

  if [ -f .env.images ] && ! cmp -s .env.images "$candidate_manifest"; then
    cp -f .env.images .env.images.previous
    chmod 600 .env.images.previous
  elif [ ! -f .env.images ]; then
    cat > .env.images.previous <<EOF
WEB_IMAGE=volleytime-web:latest
BOT_IMAGE=volleytime-bot:latest
MIGRATOR_IMAGE=volleytime-migrator:latest
RELEASE_VERSION=${previous_sha}
EOF
    chmod 600 .env.images.previous
  fi

  install -m 600 "$candidate_manifest" .env.images
  rm -f -- "$candidate_manifest"
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

  install_release_manifest "$expected_sha" "$previous_sha"

  # Build all application images on the VPS. Postgres/Caddy stay upstream images.
  "${COMPOSE[@]}" build migrate web bot

  # Database migrations are forward-only in production and run before app restart.
  "${COMPOSE[@]}" run --rm migrate
  "${COMPOSE[@]}" up -d
  docker image prune -f
}

rollback() {
  test -s .deploy/previous-git-sha
  test -s .env.images.previous
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
  cp -f .env.images.previous .env.images
  chmod 600 .env.images
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
