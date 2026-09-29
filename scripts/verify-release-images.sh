#!/usr/bin/env bash
set -euo pipefail

fail() {
  echo "$1" >&2
  exit 1
}

[ "$#" -eq 2 ] || fail "usage: verify-release-images.sh STAGING_DIR FULL_SHA"
staging_dir="$1"
release_sha="$2"
[[ "$release_sha" =~ ^[0-9a-f]{40}$ ]] || fail "release identity must be a full 40-character lowercase SHA"
[ -d "$staging_dir" ] || fail "staging directory does not exist"
archive="$staging_dir/release-images.tar.gz"
metadata="$staging_dir/release-images.meta"
[ -f "$archive" ] && [ -f "$metadata" ] || fail "release image archive or metadata is missing"

# Never source metadata: it is transferred input, not a shell program.
declare -A fields=()
count=0
while IFS= read -r line || [ -n "$line" ]; do
  [[ "$line" =~ ^([A-Z0-9_]+)=([^[:space:]]+)$ ]] || fail "invalid release image metadata"
  key="${BASH_REMATCH[1]}"
  value="${BASH_REMATCH[2]}"
  case "$key" in
    RELEASE_SHA|ARCHIVE_SHA256|ARCHIVE_BYTES|UNPACKED_BYTES|WEB_IMAGE|BOT_IMAGE|MIGRATOR_IMAGE) ;;
    *) fail "unknown release image metadata key" ;;
  esac
  [ ! -v "fields[$key]" ] || fail "duplicate release image metadata key"
  fields[$key]="$value"
  count=$((count + 1))
done < "$metadata"
[ "$count" -eq 7 ] || fail "incomplete release image metadata"
[ "${fields[RELEASE_SHA]}" = "$release_sha" ] || fail "release SHA mismatch"
[[ "${fields[ARCHIVE_SHA256]}" =~ ^[0-9a-f]{64}$ ]] || fail "invalid archive SHA-256"
for key in ARCHIVE_BYTES UNPACKED_BYTES; do
  [[ "${fields[$key]}" =~ ^[1-9][0-9]{0,14}$ ]] || fail "invalid $key"
done
for name in WEB BOT MIGRATOR; do
  lower="${name,,}"
  [ "${fields[${name}_IMAGE]}" = "volleytime-$lower:$release_sha" ] || fail "image tag mismatch: $lower"
done

archive_bytes="$(wc -c < "$archive" | tr -d '[:space:]')"
[ "$archive_bytes" = "${fields[ARCHIVE_BYTES]}" ] || fail "archive byte size mismatch"
archive_hash="$(sha256sum "$archive" | cut -d ' ' -f1)"
[ "$archive_hash" = "${fields[ARCHIVE_SHA256]}" ] || fail "archive SHA-256 mismatch"
gzip -t "$archive" || fail "archive gzip integrity check failed"
unpacked_bytes="$(gzip -cd "$archive" | wc -c | tr -d '[:space:]')"
[ "$unpacked_bytes" = "${fields[UNPACKED_BYTES]}" ] || fail "archive unpacked byte size mismatch"

# Inspect the Docker save manifest/config before allowing any image-store write.
"${PYTHON_BIN:-python3}" - "$archive" "$release_sha" <<'PY' || fail "archive image identity or content mismatch"
import json
import sys
import tarfile

archive, sha = sys.argv[1:]
expected = {f'volleytime-{name}:{sha}' for name in ('web', 'bot', 'migrator')}
with tarfile.open(archive, 'r:gz') as bundle:
    members = bundle.getmembers()
    files = {}
    for member in members:
        name = member.name.removeprefix('./')
        parts = name.split('/')
        if name.startswith('/') or any(part in ('', '..') for part in parts):
            raise ValueError('unsafe archive path')
        if not (member.isfile() or member.isdir()):
            raise ValueError('non-file archive member')
        if member.isfile():
            if name in files:
                raise ValueError('duplicate archive member')
            files[name] = member
    def read_json(name):
        member = files.get(name)
        if member is None or member.size > 16 * 1024 * 1024:
            raise ValueError('missing or oversized archive metadata')
        return json.load(bundle.extractfile(member))
    manifest = read_json('manifest.json')
    if not isinstance(manifest, list) or len(manifest) != 3:
        raise ValueError('expected three saved images')
    seen = set()
    for entry in manifest:
        tags = entry.get('RepoTags')
        if not isinstance(tags, list) or len(tags) != 1 or tags[0] not in expected:
            raise ValueError('wrong saved image tag')
        seen.add(tags[0])
        config = read_json(entry['Config'])
        if config.get('architecture') != 'amd64':
            raise ValueError('wrong saved architecture')
        if config.get('config', {}).get('Labels', {}).get('org.opencontainers.image.revision') != sha:
            raise ValueError('wrong saved revision')
        layers = entry.get('Layers')
        if not isinstance(layers, list) or not layers or any(layer not in files for layer in layers):
            raise ValueError('missing saved layer')
    if seen != expected:
        raise ValueError('missing saved image')
PY

# The compressed upload is already on disk. Reserve an additional copy plus
# twice the uncompressed payload for Docker import, and 256 MiB of headroom.
required_bytes=$((archive_bytes + 2 * unpacked_bytes + 268435456))
required_kib=$(((required_bytes + 1023) / 1024))
docker_root="$(docker info --format '{{.DockerRootDir}}')" || fail "cannot locate Docker image storage"
[ -d "$docker_root" ] || fail "Docker image storage path does not exist"
for path in "$staging_dir" "$docker_root"; do
  available_kib="$("${DF_BIN:-df}" -Pk "$path" | awk 'NR == 2 {print $4}')" || fail "cannot inspect free disk space"
  [[ "$available_kib" =~ ^[0-9]+$ ]] || fail "invalid free disk space"
  [ "$available_kib" -ge "$required_kib" ] || fail "insufficient disk space for image import"
done

docker load -i "$archive" || fail "Docker image load failed"
for name in WEB BOT MIGRATOR; do
  image="${fields[${name}_IMAGE]}"
  identity="$(docker image inspect --format '{{.Architecture}}|{{index .Config.Labels "org.opencontainers.image.revision"}}|{{join .RepoTags ","}}' "$image")" || fail "loaded image missing: $image"
  IFS='|' read -r architecture revision tags <<< "$identity"
  [ "$architecture" = amd64 ] || fail "loaded image architecture mismatch: $image"
  [ "$revision" = "$release_sha" ] || fail "loaded image revision mismatch: $image"
  [[ ",$tags," == *",$image,"* ]] || fail "loaded image tag mismatch: $image"
done
echo "verified and loaded release images for $release_sha"
