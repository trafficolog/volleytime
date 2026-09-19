# Production deploy runbook

This runbook covers the two R0 deployment paths from Tasks 9.8.3 and 9.8.7. **A verified Git bundle with a local VPS build is the active automatic path.** GHCR remains an explicit manual alternative for diagnostics or a future network change.

## Before the first production deploy

Configure the GitHub Secrets required by `.github/workflows/deploy.yml`, provision the VPS from Tasks 9.3.x, point DNS to it, and configure the Telegram Mini App/webhook. The deploy workflow deliberately fails closed when required secrets are missing.

GHCR is not required by the active path. To diagnose whether the manual alternative is usable, probe it explicitly on the VPS:

```bash
docker pull ghcr.io/trafficolog/volleytime/web:latest
```

If the pull times out or the registry is unreachable, keep `deployment_mode=local-build`. The bundle path does not require outbound GitHub or GHCR access from the VPS.

## Dedicated GitHub Actions credentials

Automation uses its own Ed25519 key named `volleytime-github-actions`. Never upload the normal `volleytime` private key or the emergency `volleytime-recovery` private key to GitHub.

Generate the CI key locally without overwriting an existing file:

```powershell
$key = 'D:\ai\freelance\keys-vps\volleytime-github-actions'
if (Test-Path $key -PathType Leaf) { throw "$key already exists" }
ssh-keygen -t ed25519 -f $key -C 'github-actions@volleytime' -N '""'
```

Append only the public key to `/home/deploy/.ssh/authorized_keys`. Prefix the line with OpenSSH `restrict` so the CI credential cannot request forwarding, agent access, X11 or a PTY:

```text
restrict ssh-ed25519 PUBLIC_KEY github-actions@volleytime
```

Keep the `.ssh` directory mode `0700` and `authorized_keys` mode `0600`. Verify all three credentials independently with `BatchMode=yes`: `volleytime-github-actions`, `volleytime`, and `volleytime-recovery`. A failure of either human-controlled key blocks rollout.

Set repository Secrets without echoing their values. The workflow requires `VPS_HOST`, `VPS_SSH_KEY`, `DOMAIN`, `DB_PASSWORD`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_BOT_USERNAME`, `WEBHOOK_SECRET_PATH`, `WEBHOOK_SECRET_TOKEN`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `BOT_INTERNAL_SECRET`, and `WEB_URL`. `VPS_SSH_KEY` contains only the dedicated CI private key. Leave absent optional Sentry, S3 and external-healthcheck values unset.

Read back names and update timestamps, never values:

```bash
gh secret list --repo trafficolog/volleytime --json name,updatedAt
```

To rotate the CI credential, create a new dedicated key, add and test its restricted public-key line, replace only `VPS_SSH_KEY`, run a source-gated deployment, and then remove the old CI line. To revoke automation immediately, remove only the authorized-key line ending in `github-actions@volleytime` and delete the GitHub Secret `VPS_SSH_KEY`. Do not modify the `volleytime` or `volleytime-recovery` lines.

## Branch promotion contract

The release path is `task branch → main → prod`: task branches are reviewed and merged into `main`, then a tested `main` revision is promoted to `prod` for production deployment. Do not develop directly in `prod`, and do not use a task branch as a production source.

The `prod` update must be a reviewed fast-forward from the selected `main` revision. A push to `main` runs the normal CI workflow but does not deploy production. A push to `prod` automatically starts the verified-bundle local-build workflow; `workflow_dispatch` remains available for an intentional local-build rerun or the manual GHCR alternative.

Every manual run must select `prod` in the GitHub **Branch** dropdown (or pass `--ref prod` through GitHub CLI). The workflow source gate rejects `main`, task branches, and tags before tests, image publication, production-secret handling, or VPS access.

## Path A — verified bundle and build on VPS (active)

A push to `prod` uses this path automatically. A manual rerun selects `deployment_mode=local-build` and the `prod` branch. GitHub Actions:

1. tests/lint/typecheck;
2. creates `release.bundle` from the checked-out `prod` commit;
3. uploads the bundle, release helpers, and a mode-0600 production env staging file;
4. runs `deploy-bundle` with the immutable `${{ github.sha }}`;
5. runs the smoke check and invokes local rollback if smoke fails.

The VPS script verifies the bundle and exact advertised SHA before recording the previous revision. It then creates the local database backup, confirms a clean tracked `prod` checkout and fast-forward ancestry, advances to the verified commit, builds `migrate web bot`, runs migrations, and starts the stack. Untracked runtime state such as `.env`, `.deploy/`, and `backups/` is preserved.

Before the build, the script writes `.env.images` with SHA-tagged local images and `RELEASE_VERSION` equal to the full expected commit SHA. If that candidate differs from the active manifest, the active file is copied to `.env.images.previous` first. A same-SHA redeploy deliberately retains the existing previous manifest so it does not erase the real rollback target. The smoke check rejects a web health response whose `release` differs from the workflow SHA.

The effective command is:

```bash
bash .deploy/scripts/deploy-local-build.sh deploy-bundle .deploy/release.bundle EXPECTED_FULL_SHA
```

There is no server-side `git fetch`, `git pull`, or registry pull in this path. Bundle verification uses only the host Bash and Git already required by the checkout; host Node.js is not required. The VPS needs Docker/Compose but no outbound GitHub or GHCR egress.

## Path B — GHCR (manual alternative)

Use this only after the GHCR probe succeeds reliably. Run the **Deploy** workflow manually on `prod` and select `deployment_mode=ghcr`. The workflow:

1. builds and pushes `web`, `migrator`, and `bot` images tagged with the commit SHA;
2. materializes production secrets into a mode-0600 `.env` on the VPS;
3. records the previous image set and pulls the SHA-tagged images;
4. runs migrations as a separate stage and starts the stack;
5. restores `.env.images.previous` if smoke fails.

For a direct diagnostic probe only:

```bash
docker pull ghcr.io/trafficolog/volleytime/web:latest
```

## Rollback

### GHCR path

The workflow records the previous image set before replacing `.env.images`. If smoke fails it restores `.env.images.previous` and starts the previous SHA-tagged images.

For a manual GHCR rollback, verify the target SHA and restore the corresponding image variables before `docker compose ... up -d`.

### verified-bundle local-build path

The local-build deploy records the previous Git SHA and image manifest before advancing `prod` from the verified bundle. To return to it:

```bash
cd /opt/volleytime
bash .deploy/scripts/deploy-local-build.sh rollback
```

Rollback performs `git reset --hard` to the recorded revision, restores `.env.images.previous`, then rebuilds web/bot under the restored tags and release identity before restarting them.

**Database migrations are not automatically reversed.** R0 production migrations must be forward-compatible with the previous application revision. A destructive migration requires a separately reviewed database rollback plan and a tested backup restore; do not improvise it during an incident.

## Production verification checklist

After the first live deployment verify:

- `https://<DOMAIN>/api/health` returns 200 and reports the database healthy;
- the Telegram bot answers through webhook mode;
- the Mini App opens through HTTPS and authenticates with real initData;
- an organizer can create an event and a second Telegram account can book it;
- backup upload reaches the configured S3 bucket;
- restore-test succeeds against a recent backup;
- Sentry receives a controlled web and bot test error;
- UptimeRobot/other external health monitoring is active;
- rollback is exercised once and the service returns healthy afterwards.

Record the verified-bundle `local-build` path as active only after this VPS verification. Keep GHCR classified as a manual alternative until its reachability and rollback are independently exercised.
