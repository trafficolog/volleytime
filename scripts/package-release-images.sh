#!/usr/bin/env bash
set -euo pipefail

fail() {
  echo "$1" >&2
  exit 1
}

[ "$#" -eq 2 ] || fail "usage: package-release-images.sh FULL_SHA OUTPUT_DIR"
release_sha="$1"
[[ "$release_sha" =~ ^[0-9a-f]{40}$ ]] || fail "release identity must be a full 40-character lowercase SHA"

output_dir="$2"
[ -n "$output_dir" ] || fail "output directory is required"

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo_root="$(cd "$script_dir/.." && pwd)"
cd "$repo_root"

umask 077
mkdir -p -m 700 "$output_dir"
output_dir="$(cd "$output_dir" && pwd)"
archive="$output_dir/release-images.tar.gz"
metadata="$output_dir/release-images.meta"
[ ! -e "$archive" ] && [ ! -e "$metadata" ] || fail "release image artifacts already exist"

raw=""
archive_tmp=""
metadata_tmp=""
published_archive=0
success=0
cleanup() {
  [ -z "$raw" ] || rm -f -- "$raw"
  [ -z "$archive_tmp" ] || rm -f -- "$archive_tmp"
  [ -z "$metadata_tmp" ] || rm -f -- "$metadata_tmp"
  if [ "$success" -ne 1 ] && [ "$published_archive" -eq 1 ]; then
    rm -f -- "$archive"
  fi
}
trap cleanup EXIT

web_image="volleytime-web:$release_sha"
bot_image="volleytime-bot:$release_sha"
migrator_image="volleytime-migrator:$release_sha"

for entry in \
  "web:apps/web/Dockerfile:$web_image" \
  "bot:apps/bot/Dockerfile:$bot_image" \
  "migrator:docker/migrator.Dockerfile:$migrator_image"; do
  IFS=: read -r _name dockerfile image <<< "$entry"
  docker build \
    --platform linux/amd64 \
    --label "org.opencontainers.image.revision=$release_sha" \
    -f "$dockerfile" -t "$image" .
done

for image in "$web_image" "$bot_image" "$migrator_image"; do
  identity="$(docker image inspect --format '{{.Architecture}}|{{index .Config.Labels "org.opencontainers.image.revision"}}|{{join .RepoTags ","}}' "$image")"
  IFS='|' read -r architecture revision tags <<< "$identity"
  [ "$architecture" = amd64 ] || fail "image architecture mismatch: $image"
  [ "$revision" = "$release_sha" ] || fail "image revision mismatch: $image"
  [[ ",$tags," == *",$image,"* ]] || fail "image tag mismatch: $image"
done

raw="$(mktemp "$output_dir/.release-images.XXXXXXXX.tar")"
archive_tmp="$(mktemp "$output_dir/.release-images.XXXXXXXX.tar.gz")"
metadata_tmp="$(mktemp "$output_dir/.release-images.XXXXXXXX.meta")"
docker save -o "$raw" "$web_image" "$bot_image" "$migrator_image"
unpacked_bytes="$(wc -c < "$raw" | tr -d '[:space:]')"
[ "$unpacked_bytes" -gt 0 ] || fail "Docker export is empty"
gzip -c "$raw" > "$archive_tmp"
archive_bytes="$(wc -c < "$archive_tmp" | tr -d '[:space:]')"
archive_sha256="$(sha256sum "$archive_tmp" | cut -d ' ' -f1)"

printf 'RELEASE_SHA=%s\nARCHIVE_SHA256=%s\nARCHIVE_BYTES=%s\nUNPACKED_BYTES=%s\nWEB_IMAGE=%s\nBOT_IMAGE=%s\nMIGRATOR_IMAGE=%s\n' \
  "$release_sha" "$archive_sha256" "$archive_bytes" "$unpacked_bytes" \
  "$web_image" "$bot_image" "$migrator_image" > "$metadata_tmp"
chmod 600 "$archive_tmp" "$metadata_tmp"
mv -- "$archive_tmp" "$archive"
archive_tmp=""
published_archive=1
mv -- "$metadata_tmp" "$metadata"
metadata_tmp=""
success=1
echo "packaged release images for $release_sha"
