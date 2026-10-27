#!/usr/bin/env bash
# Task 9.8.18: evaluate VPS free space from `df -Pk` output on stdin.
# Writes a Markdown table to $GITHUB_STEP_SUMMARY (stdout when unset) and a
# ::warning:: per filesystem below DISK_MIN_FREE_PCT percent or
# DISK_MIN_FREE_GIB GiB free. Exit 1 when no disk data was read; with
# --fail-on-low, exit 2 when any filesystem is low. Read-only.
set -euo pipefail

fail_on_low=no
case "${1:-}" in
  '') ;;
  --fail-on-low) fail_on_low=yes ;;
  *) echo "::error::usage: disk-status.sh [--fail-on-low] < df-output"; exit 1 ;;
esac
min_pct="${DISK_MIN_FREE_PCT:-25}"
min_gib="${DISK_MIN_FREE_GIB:-5}"
if ! [[ "$min_pct" =~ ^[0-9]{1,2}$ && "$min_gib" =~ ^[0-9]{1,4}$ ]]; then
  echo '::error::DISK_MIN_FREE_PCT must be 0-99 and DISK_MIN_FREE_GIB 0-9999'
  exit 1
fi
summary="${GITHUB_STEP_SUMMARY:-/dev/stdout}"

# One row per filesystem: name, mount, size KiB, available KiB, free %, status.
rows="$(awk -v min_pct="$min_pct" -v min_kib="$((min_gib * 1024 * 1024))" '
  $2 ~ /^[0-9]+$/ && $4 ~ /^[0-9]+$/ && $2 > 0 && !seen[$1]++ {
    low = ($4 * 100 < min_pct * $2 || $4 < min_kib) ? "low" : "ok"
    printf "%s\t%s\t%s\t%s\t%d\t%s\n", $1, $6, $2, $4, int($4 * 100 / $2), low
  }')"

{
  echo '### VPS disk'
  echo
} >> "$summary"
if [ -z "$rows" ]; then
  echo '::error::VPS disk usage is unavailable'
  echo 'Disk usage is unavailable: the read-only SSH check returned no `df` data.' >> "$summary"
  exit 1
fi

gib() { awk -v kib="$1" 'BEGIN { printf "%.1f GiB", kib / 1048576 }'; }
low=no
{
  echo '| Filesystem | Mount | Size | Free | Free % | Status |'
  echo '| --- | --- | --- | --- | --- | --- |'
} >> "$summary"
while IFS=$'\t' read -r fs mount size avail pct status; do
  echo "| $fs | $mount | $(gib "$size") | $(gib "$avail") | $pct% | $status |" >> "$summary"
  if [ "$status" = low ]; then
    low=yes
    echo "::warning::VPS disk low: $mount has $(gib "$avail") free ($pct%); see the retention policy in the deploy runbook"
  fi
done <<< "$rows"
{
  echo
  echo "Warning threshold: less than $min_pct% or less than $min_gib GiB free."
} >> "$summary"

[ "$fail_on_low" = yes ] && [ "$low" = yes ] && exit 2
exit 0
