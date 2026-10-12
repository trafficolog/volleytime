#!/usr/bin/env bash
# Idempotent branch protection for main/prod (Task 9.8.17).
# Prints the planned payloads by default; pass --apply to change GitHub settings.
set -euo pipefail

repo="${GITHUB_REPOSITORY:-$(gh repo view --json nameWithOwner -q .nameWithOwner)}"
apply=false
[ "${1:-}" = "--apply" ] && apply=true

# Job names from .github/workflows/ci.yml. Admins are included: merges by the owner token
# also need a PR and green checks. strict=false: main push CI re-checks every merged SHA
# and Promote only accepts a SHA whose main CI succeeded.
main_payload='{
  "required_status_checks": {
    "strict": false,
    "contexts": [
      "Lint · Format · Typecheck",
      "Test (unit + integration)",
      "Build",
      "Runner image build-export-import"
    ]
  },
  "enforce_admins": true,
  "required_pull_request_reviews": {
    "required_approving_review_count": 0,
    "dismiss_stale_reviews": false
  },
  "restrictions": null,
  "allow_force_pushes": false,
  "allow_deletions": false,
  "required_linear_history": false
}'

# prod moves only by fast-forward from Promote; no PR or checks on the branch itself.
prod_payload='{
  "required_status_checks": null,
  "enforce_admins": false,
  "required_pull_request_reviews": null,
  "restrictions": null,
  "allow_force_pushes": false,
  "allow_deletions": false
}'

for pair in "main:$main_payload" "prod:$prod_payload"; do
  branch="${pair%%:*}"
  payload="${pair#*:}"
  echo "== $repo $branch"
  if $apply; then
    printf '%s' "$payload" | gh api -X PUT "repos/$repo/branches/$branch/protection" --input - >/dev/null
    echo "applied"
  else
    printf '%s\n' "$payload"
  fi
done

$apply || echo "Dry run. Re-run with --apply to change GitHub settings."
