#!/usr/bin/env bash
set -euo pipefail

# Pre-production validation only: no deployment secrets, SSH or publication.
[ "${GITHUB_ACTIONS:-}" = true ] && [ "${RUNNER_OS:-}" = Linux ] || {
  echo 'Image validation must run on the Linux Actions runner' >&2; exit 1;
}
[ "$#" -eq 1 ] && [[ "$1" =~ ^[0-9a-f]{40}$ ]] || exit 1
sha="$1"
helper_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$helper_dir/.."
[ "$(git rev-parse HEAD)" = "$sha" ] || { echo 'Runner checkout SHA mismatch' >&2; exit 1; }
: "${RUNNER_TEMP:?runner temporary directory is required}"
docker_root="$(docker info --format '{{.DockerRootDir}}')"
[ -d "$docker_root" ] || { echo 'Docker storage directory is unavailable' >&2; exit 1; }
capacity() {
  echo "Runner image capacity evidence: $sha"
  df -Pk . "$RUNNER_TEMP" "$docker_root"
  free -m
  docker system df
}
trap 'result=$?; capacity || true; exit "$result"' EXIT
capacity
# Conservative initial build floor. The verifier separately checks actual
# compressed/unpacked sizes and remaining import reserve after the build.
for path in . "$RUNNER_TEMP" "$docker_root"; do
  available="$(df -Pk "$path" | awk 'NR == 2 {print $4}')"
  [[ "$available" =~ ^[0-9]+$ ]] && [ "$available" -ge 12582912 ] || {
    echo 'Insufficient runner capacity (12 GiB initial floor); stop for redesign, do not prune' >&2
    exit 1
  }
done
stage="$RUNNER_TEMP/image-validation-$sha"
bash "$helper_dir/package-release-images.sh" "$sha" "$stage"
cat "$stage/release-images.meta"
bash "$helper_dir/verify-release-images.sh" "$stage" "$sha"
echo "Runner build/export/import verified: $sha"
