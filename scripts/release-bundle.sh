#!/usr/bin/env bash
set -euo pipefail

usage() {
  echo "usage: release-bundle.sh verify|advance --repo PATH --bundle FILE --expected SHA"
}

fail() {
  echo "$1" >&2
  exit 1
}

if [ "${1:-}" = "--help" ] || [ "${1:-}" = "-h" ]; then
  usage
  exit 0
fi

command="${1:-}"
shift || true
case "$command" in
  verify | advance) ;;
  *) fail "command must be verify or advance" ;;
esac

repo=""
bundle=""
expected=""
while [ "$#" -gt 0 ]; do
  option="$1"
  value="${2:-}"
  [ -n "$value" ] || fail "required arguments: --repo PATH --bundle FILE --expected SHA"
  case "$option" in
    --repo) repo="$value" ;;
    --bundle) bundle="$value" ;;
    --expected) expected="$value" ;;
    *) fail "required arguments: --repo PATH --bundle FILE --expected SHA" ;;
  esac
  shift 2
done

[ -n "$repo" ] && [ -n "$bundle" ] && [ -n "$expected" ] || \
  fail "required arguments: --repo PATH --bundle FILE --expected SHA"
[[ "$expected" =~ ^[0-9a-fA-F]{40}$ ]] || \
  fail "expected SHA must be a full 40-character commit SHA"
expected="$(printf '%s' "$expected" | tr '[:upper:]' '[:lower:]')"

advertised_ref=""
verify_bundle() {
  git -C "$repo" bundle verify "$bundle" >/dev/null
  while read -r sha ref; do
    if [ "$(printf '%s' "$sha" | tr '[:upper:]' '[:lower:]')" = "$expected" ]; then
      advertised_ref="$ref"
      break
    fi
  done < <(git -C "$repo" bundle list-heads "$bundle")
  [ -n "$advertised_ref" ] || fail "expected SHA is not advertised by bundle"
}

verify_bundle
if [ "$command" = "verify" ]; then
  echo "verified release bundle for $expected"
  exit 0
fi

[ "$(git -C "$repo" branch --show-current)" = "prod" ] || \
  fail "production checkout must be on prod"
[ -z "$(git -C "$repo" status --porcelain --untracked-files=no)" ] || \
  fail "tracked checkout is not clean"

git -C "$repo" fetch --no-tags "$bundle" "$advertised_ref" >/dev/null
fetched="$(git -C "$repo" rev-parse FETCH_HEAD | tr '[:upper:]' '[:lower:]')"
[ "$fetched" = "$expected" ] || fail "fetched commit does not match expected SHA"
git -C "$repo" merge-base --is-ancestor HEAD FETCH_HEAD || fail "target is not a fast-forward"
git -C "$repo" checkout prod >/dev/null
git -C "$repo" merge --ff-only FETCH_HEAD >/dev/null
echo "advanced prod to $expected"
