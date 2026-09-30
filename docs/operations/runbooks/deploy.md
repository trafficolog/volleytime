# Production deploy runbook

Task 9.8.10 changes the workflow default to **image-bundle**: build on the Actions runner, transfer exact-SHA images and a verified Git bundle, then activate without building on the VPS. This is the locally implemented candidate path; exact-head CI, independent whole-branch review and controlled production acceptance remain required before rollout. GHCR remains an explicit manual alternative. Historical local-build acceptance does not validate this new path.

## Provisioning or disaster-recovery prerequisites

The current production VPS, DNS and required GitHub Secrets are configured. For a replacement VPS or disaster recovery, provision Tasks 9.3.x, point DNS to it, restore the required secret names and configure the Telegram Mini App transport. The deploy workflow deliberately fails closed when required secrets are missing.

GHCR is not required by the active path. To diagnose whether the manual alternative is usable, probe it explicitly on the VPS:

```bash
docker pull ghcr.io/trafficolog/volleytime/web:latest
```

If the pull times out or the registry is unreachable, use `deployment_mode=image-bundle` after its release gates pass. A successful `latest` probe is diagnostic only; deployment uses immutable full SHA tags. The image-bundle path requires no outbound GitHub, GHCR or npm access from the VPS. Host Bash, Git, Docker/Compose, Python >=3.9, curl, flock and sufficient staging/import space are required.

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

Set repository Secrets without echoing their values. The workflow requires `VPS_HOST`, `VPS_SSH_KEY`, `DOMAIN`, `DB_PASSWORD`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_BOT_USERNAME`, `WEBHOOK_SECRET_PATH`, `WEBHOOK_SECRET_TOKEN`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `BOT_INTERNAL_SECRET`, and `WEB_URL`; image-bundle also requires `SMOKE_TG_ID` for the technical synthetic account and cleanup. `VPS_SSH_KEY` contains only the dedicated CI private key. Leave absent optional Sentry, S3 and external-healthcheck values unset.

Before rendering or uploading the production env, the workflow calls Telegram `getMe` and verifies that the normalized `TELEGRAM_BOT_USERNAME` belongs to `TELEGRAM_BOT_TOKEN`. A mismatch, network failure or malformed response stops the deployment without printing the token or tokenized Bot API URL. When rotating the bot token or username, update both secrets as one identity and let this guard pass before any VPS mutation.

Read back names and update timestamps, never values:

```bash
gh secret list --repo trafficolog/volleytime --json name,updatedAt
```

To rotate the CI credential, create a new dedicated key, add and test its restricted public-key line, replace only `VPS_SSH_KEY`, run a source-gated deployment, and then remove the old CI line. To revoke automation immediately, remove only the authorized-key line ending in `github-actions@volleytime` and delete the GitHub Secret `VPS_SSH_KEY`. Do not modify the `volleytime` or `volleytime-recovery` lines.

## Branch promotion contract

The release path is `task branch → main → prod`: task branches are reviewed and merged into `main`, then a tested `main` revision is promoted to `prod` for production deployment. Do not develop directly in `prod`, and do not use a task branch as a production source.

The `prod` update must be a reviewed fast-forward from the selected `main` revision, after exact-head task CI, independent review and merge-tree/main CI verification. A push to `main` runs CI. A push to `prod` automatically starts image-bundle deployment; `workflow_dispatch` defaults to `image-bundle` or explicitly selects `ghcr`. `local-build` is no longer a production workflow option. Inspect any prior attempt before rerunning.

Every manual run must select `prod` in the GitHub **Branch** dropdown (or pass `--ref prod` through GitHub CLI). The workflow source gate rejects `main`, task branches, and tags before tests, image publication, production-secret handling, or VPS access.

## Telegram update transport

`PRODUCTION_BOT_MODE` is an optional GitHub repository variable with the allowlisted values `polling` or `webhook`. When it is unset, the production env renderer selects `polling`. This is the R0 pilot fallback for a hosting route where outbound Telegram IPv6 works but Telegram's IPv4-only webhook traffic does not reach the VPS.

Polling startup calls `deleteWebhook()` without `drop_pending_updates`, so Telegram pending updates remain available to `getUpdates`. Keep `NODE_OPTIONS=--dns-result-order=ipv6first` for the bot while Telegram IPv4 is unavailable. Verify the bot health response reports `mode=polling`, send a real update, and confirm it is handled once.

Set `PRODUCTION_BOT_MODE=webhook` only after a packet capture proves Telegram IPv4 traffic reaches the public VPS interface. The webhook server, Caddy route and secrets remain deployed so this switch does not require a code change. Polling is a transport fallback, not evidence that direct webhook ingress is fixed.

## Path A — image-bundle (new workflow default)

Before promotion, rerun the five repository gates with PostgreSQL, focused deployment contracts, shell/YAML checks and independent review. Before controlled deployment, recheck all three SSH keys, VPS health, disk capacity, old image availability, backup/manifest/pointer identity and absence of a running deployment. Historical free-space and health snapshots are not current evidence. If capacity fails, stop without Docker prune.

A push to `prod`, or manual `deployment_mode=image-bundle` on `prod`, follows these stages:

1. Require exact `refs/heads/prod` and full lowercase 40-character SHA; pass CI tests/lint/typecheck.
2. On the runner, build `web`, `bot` and `migrator` for `linux/amd64` with `volleytime-SERVICE:FULL_SHA` tags and matching OCI revision labels. Production secrets are introduced after image packaging, never as build inputs.
3. Create `release.bundle`, `release-images.tar.gz` and allowlisted `release-images.meta`. Check remote capacity across staging, temporary SCP extraction and Docker storage, then transfer helpers and mode-0600 `.env.production` into mode-0700 `/opt/volleytime/.deploy/incoming/FULL_SHA/`. Existing SHA staging requires manual audit before rerun.
4. Under `.deploy/image-bundle.lock` (`flock`), verify clean tracked `prod`, exact bundle/fast-forward ancestry, healthy old web/bot/public identity and local old images. Verify archive size/hash/metadata/architecture/labels and import capacity, load images, then inspect their actual identity. Loading does not activate containers.
5. Recheck live identity, create and validate the private local `pg_dump`/gzip backup, snapshot old env, advance Git (or confirm candidate checkout already reached), and atomically install previous pointer, SHA manifest and candidate env.
6. Run `migrate` separately with `--no-build`, then `up --no-build -d web bot`; keep PostgreSQL/Caddy running. Check both services, database and exact public HTTPS health.
7. Run bounded external exact-SHA synthetic initData/forged-signature smoke with technical-session cleanup, then `confirm-smoke FULL_SHA`. Only this confirmation records `smoke-passed`.

The activation command used by the workflow is:

```bash
cd /opt/volleytime
bash .deploy/incoming/FULL_SHA/scripts/deploy-image-bundle.sh deploy .deploy/incoming/FULL_SHA FULL_SHA
```

Transfer and activation each have a 30-minute command timeout (35-minute step bound), with separate 2-minute SSH connection bounds. External smoke is bounded to 180 seconds. A timeout or disconnected runner does not prove the remote process stopped.

## Partial state and manual recovery checkpoint

The historical failed deployment had checkout/candidate manifest `a16eb2a2f821e5e8f46fd8749f12d571d7aeadf4`, but live web/bot/public health and previous manifest/pointer `67bbfe89acaac04992b8128d45cb1b40f8acc75c`. Recheck this state live before any action. Never derive the rollback target from checkout or candidate manifest alone. The image helper accepts an explainable partial state only when live health and previous manifest/pointer agree and all three old images exist locally. GHCR rejects this partial state.

Phase markers in `.deploy/image-bundle-phase` are `verified → loaded → backed-up → migrated → activated → smoke-passed`, with failure/recovery markers as applicable. They are evidence hints, not proof of current state. Direct helper retries at `verified`/`loaded` revalidate old runtime; workflow reruns still refuse existing SHA staging. `backed-up`, `migrated`, unfinished activation and `rolled-back` require manual recovery review. Same-SHA `smoke-passed` retry verifies checkout and exact healthy runtime without changing previous history; an already-live target without that completed marker fails closed.

After timeout, interruption, unexpected phase or rollback failure, use the normal/recovery key for a read-only audit:

```bash
cd /opt/volleytime
ps -ef | grep -E 'deploy-(image-bundle|ghcr-manual|local-build)|docker.*(load|compose|build)'
lslocks
git branch --show-current
git rev-parse HEAD
git status --porcelain --untracked-files=no
cat .deploy/image-bundle-phase .deploy/previous-git-sha .env.images .env.images.previous
docker ps --format '{{.Names}} {{.Status}} {{.Image}}'
docker image ls --no-trunc
df -Pk /opt/volleytime/.deploy/incoming /tmp
curl --fail --silent --show-error --max-time 10 https://volleytime.by/api/health
```

Missing phase files are evidence to investigate. Inspect Docker storage capacity, exact web/bot image tags/labels and bot health, backup gzip/permissions, schema migration state and synthetic cleanup through their runbooks without displaying env contents. Establish whether any PID still owns the lock and what mutation completed. Record the observed phase and selected recovery action before changing state. Do not blindly rerun, reboot, reset Git, delete phase/snapshot files, prune images or restore the database. Preserve private env snapshots, rollback images and backup; staging cleanup requires a verified result and saved evidence.

## Exact application rollback

The SHA argument identifies the **failed candidate**, not an arbitrary target. After a read-only audit confirms eligibility, run the helper preserved in that candidate's staging:

```bash
cd /opt/volleytime
bash .deploy/incoming/FULL_CANDIDATE_SHA/scripts/deploy-image-bundle.sh rollback FULL_CANDIDATE_SHA
```

Only matching `activated`/`smoke-passed` phases are eligible. The helper verifies candidate checkout, clean tracked `prod`, old ancestor commit, previous pointer/manifest/env snapshot, local old images and explainable runtime tags. It restores old Git, exact SHA manifest and saved env, starts old web/bot with `--no-build`, and checks old web/bot/DB/public health. It does not build or pull images.

A controlled backup failure does not advance Git. A controlled migration failure does not switch web/bot; it restores old source/manifest/env and checks old runtime. Controlled activation or readiness failure recovers old runtime locally. Actions requests rollback after external smoke only when activation succeeded and smoke explicitly reported a controlled failure. Transport errors, smoke timeout, ambiguous remote state and failed rollback require manual audit; they must not be reported as successful releases.

**Database migrations are not automatically reversed.** R0 production migrations must be forward-compatible and remain backward-compatible with the previous application. A destructive migration needs a separately reviewed database recovery plan and tested restore. Historical local-build rollback/rebuild commands are not recovery commands for this path.

## Path B — GHCR (explicit manual alternative)

Use only after immutable-SHA pulls and registry authentication/reachability are verified. Dispatch **Deploy** on `prod` with `deployment_mode=ghcr`. Runner build/push and Git bundle delivery remain source-gated.

The GHCR helper shares the activation lock. Before backup/mutation it requires healthy live web/bot/public health, current manifest, local old images and server checkout to agree, and staged env to be byte-identical to live env. It does not rotate env or repair a partial candidate manifest. It verifies the exact fast-forward bundle, validates backup, snapshots old manifest/history, pulls candidate images through a temporary manifest, advances Git before migration, and starts only web/bot with `--no-build`. Candidate readiness has bounded retries (24 × 5 seconds by default); detached Compose startup alone is not success.

Controlled migration/start/readiness failures restore old Git/manifest/history and verify exact old health; old env remains intact. Reserved timeout/interruption exit codes require manual recovery audit. Existing per-SHA snapshots reject blind same-SHA reuse. External smoke uses the shared workflow smoke; GHCR production acceptance must explicitly retain synthetic auth/forgery/cleanup evidence and must not be inferred from a basic health-only run.

After verified eligible `activated` phase, explicit rollback uses:

```bash
cd /opt/volleytime
bash .deploy/scripts/deploy-ghcr-manual.sh rollback FULL_CANDIDATE_SHA
```

This restores snapshotted source/manifest/history and restarts locally available old images without a build or pull. Inspect `.deploy/ghcr-manual-phase`, private per-SHA snapshots, PID/lock, schema and exact health on any ambiguous failure. Reachability, real image pulls and this rollback remain unvalidated in production by local fixtures.

## Production acceptance and evidence

Historical `v0.1.4` evidence covers exact HTTPS health, healthy containers, polling, release-local backup/isolated restore and controlled rollback/redeploy. Published `v0.1.5` bot-identity evidence remains separate. Neither proves Task 9.8.10 rollout.

After controlled deployment, save a new evidence record under `docs/operations/qa/` containing the successful Actions run and exact source SHA, server Git SHA, all three image tags/labels, live web/bot and public health SHA, healthy DB, validated backup created before migration, runtime smoke and synthetic-session cleanup. On failure, record actual phase and recovery result without declaring release success.

Only after successful runtime smoke perform [manual Telegram QA](../qa/telegram-miniapp-checklist.md) on test accounts/organization, including Mini App/BotFather/deeplink/initData and organizer/player flows. Tasks 8.7.2/8.8.11 remain separate. Tag/Release `v0.1.6` requires separate user acceptance of Telegram/pilot evidence; do not rewrite published tags. S3 upload/retention/restore, external Sentry/UptimeRobot, repaired webhook ingress and a week of real trainings remain separate R0 acceptance gates.
