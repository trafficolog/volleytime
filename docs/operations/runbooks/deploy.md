# Production deploy runbook

Latest R0.7 acceptance,2026-10-11: production `e293e069dfc637db835c36a477639379c7e2bcb3`, [Deploy37673966652](https://github.com/trafficolog/volleytime/actions/runs/37673966652) SUCCESS after reviewed PR94/exact-head/main CI. Owner confirmed native Android/Desktop two-account matrix and pilot acceptance; [final evidence](../qa/2026-10-11-r07-pilot-acceptance.md) records testimony and client-version limitations. Publish new immutable v0.1.7 tag on this exact runtime SHA after closure-docs CI/merge; docs-only main advancement requires no new deploy. Retain d98ed97 compatible previous runtime/backups and split-safe recovery. Historical R0.6 and full original R0 operational gates remain separate.

Current R0.7 candidate acceptance,2026-10-06: [Deploy37419396620](https://github.com/trafficolog/volleytime/actions/runs/37419396620) succeeded on `d98ed97b1ef81dd695f4a94aafbfeafc90d4836c` after exact-head/main CI and reviewed main→prod fast-forward. Backup preceded migration; exact Git/image/runtime/public health and synthetic smoke/cleanup agree, phase smoke-passed. [Production evidence](../qa/2026-10-06-r07-production-candidate.md) separates technical publication from still-open real two-account Telegram/pilot/owner acceptance. Split creation is enabled on the complete candidate; bot remains polling. Preserve previous967aff3 images/backups; any rollback must use the quiescent split compatibility guard below. The older acceptance entries are historical, not the current live SHA. No final v0.1.7 tag/Release yet.

Current acceptance, 2026-09-30: corrected [Deploy 36772178900](https://github.com/trafficolog/volleytime/actions/runs/36772178900) succeeded on `967aff312f962196e7347cc0e50f879f25f6dffa`, including bundled Node migrator without runtime package-manager downloads. Backup preceded migration; Git/images/runtime/public health agree and synthetic smoke/cleanup passed. [Current production evidence](../qa/2026-09-30-r06-production-candidate.md#corrected-rollout-and-pilot-ui-fixes) supersedes the historical offline-runtime blocker below. Real Telegram/pilot, isolated restore and actual production rollback execution are not inferred from this rollout.

## Historical first-rollout checkpoint

Task 9.8.10 changes the workflow default to **image-bundle**: build on the Actions runner, transfer exact-SHA images and a verified Git bundle, then activate without building on the VPS. The first controlled rollout passed on SHA `64f18506b03081bc7b9c065c8371cd3e62f10b30`; [production evidence](../qa/2026-09-30-r06-production-candidate.md) records CI, backup, runtime and synthetic smoke, **plus an open runtime npm dependency in the migrator container**. Until fixed and re-verified, that successful rollout does not satisfy the no-VPS-npm requirement or establish real Telegram/pilot acceptance or a generally proven future rollback. GHCR remains an explicit manual alternative. Historical local-build acceptance does not validate this new path.

The offline-runtime remediation invokes bundled `tsx` directly through Node in the migrator image. Runner packaging probes that final CLI with `docker run --rm --network none` before exporting the archive. The local isolated PostgreSQL migration smoke is recorded in the production-candidate evidence; updated reviewed CI and a controlled rollout without runtime downloads are still required before closing the offline-VPS acceptance.

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

Before the fast-forward, require the **Runner image build-export-import** CI job to succeed for both the reviewed PR head and the exact selected `main` SHA. This job builds all three images, exports their real Docker archive, verifies/imports it and records disk/memory/image-store capacity in the job log and summary, without deployment secrets, VPS access or publication. A PR run alone does not validate a new merge SHA. Inspect the exact SHA and successful job conclusion; pending, cancelled, missing or failed results block promotion. Record the CI run URL and capacity evidence with the release. This promotion gate is an operator requirement; the deploy workflow does not query prior main CI or configure branch protection.

The runner uses a 12 GiB initial build floor and a separate measured archive/import reserve after packaging. If either capacity gate or the real build/export/import fails, retain the measured evidence and stop for redesign. Do not prune runner/VPS images to make a failing capacity gate pass. Local tests and local application builds do not substitute for this runner evidence; avoid local Docker export on the capacity-constrained Windows C: drive.

### Promote workflow (default path, Task 9.8.17)

Run **Actions → Promote to production** (or `gh workflow run promote.yml -f sha=<full main SHA>`). The workflow refuses a SHA outside `main` history, a SHA without a successful `CI` run for the `main` push (the run includes the image-bundle job), and a non-fast-forward `prod`. When `prod` already equals the SHA nothing happens; a same-SHA redeploy is not offered because the earlier attempt's `.deploy/incoming/<sha>` staging requires a manual audit first.

GitHub does not let `GITHUB_TOKEN` push a range that changes `.github/workflows/`, and its pushes do not start `on: push` workflows:

- With repository secret `PROMOTE_TOKEN` (fine-grained PAT for this repository: Contents and Workflows read/write) Promote pushes with it, and Deploy starts from the `prod` push.
- Without it Promote pushes with `GITHUB_TOKEN` and dispatches **Deploy** on `prod` (`deployment_mode=image-bundle`) after re-checking that `prod` still equals the SHA. A range that changes workflows fails before any push; perform the reviewed manual `git push origin <sha>:prod` instead.

GitHub keeps one pending run per concurrency group: after three or more quick merges into `main` the middle SHA's CI may be cancelled and that SHA cannot be promoted; promote a newer SHA instead. Store `PROMOTE_TOKEN` as an environment secret of a dedicated `promote` environment (and add `environment: promote` to the Promote job) if you want to keep the Workflows-scoped token away from other workflows. Branch protection includes administrators: an emergency direct push to `main` requires temporarily relaxing protection with `gh api` and restoring it with `scripts/github/apply-branch-protection.sh --apply`.

Promote checks main CI only: exact-head PR CI and independent review remain the merge gate. The Deploy job runs in the `production` GitHub Environment; required reviewers configured there pause it until approval.

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
6. Use the staged `compose-images-only.yml` override to remove build definitions and set `pull_policy: never` for app/migration services. Run migration with `run --rm --no-deps --pull never migrate`, then `up --no-build -d web bot`; keep PostgreSQL/Caddy running. Check both services, database and exact public HTTPS health. Compose must support `!reset` overrides (validated locally with v5.1.1); verify the installed VPS CLI before rollout.
7. Run bounded external exact-SHA synthetic initData/forged-signature smoke with technical-session cleanup, then `confirm-smoke FULL_SHA`. Only this confirmation records `smoke-passed`.

The activation command used by the workflow is:

```bash
cd /opt/volleytime
bash .deploy/incoming/FULL_SHA/scripts/deploy-image-bundle.sh deploy .deploy/incoming/FULL_SHA FULL_SHA
```

Transfer and activation each have a 30-minute command timeout (35-minute step bound), with separate 2-minute SSH connection bounds. External synthetic smoke has a five-minute timeout plus a 15-second prewait. A timeout or disconnected runner does not prove the remote process stopped.

## Partial state and manual recovery checkpoint

The historical failed deployment had checkout/candidate manifest `a16eb2a2f821e5e8f46fd8749f12d571d7aeadf4`, but live web/bot/public health and previous manifest/pointer `67bbfe89acaac04992b8128d45cb1b40f8acc75c`. Recheck this state live before any action. Never derive the rollback target from checkout or candidate manifest alone. The image helper accepts an explainable partial state only when live health and previous manifest/pointer agree and all three old images exist locally. Before image import, backup or env snapshot, the staged `verify-live-rollback-env.sh` renders the previous Git SHA's Compose configuration with current `.env` and the previous manifest, merges the old local images' environment defaults and compares both services against live container `Config.Env` sets in memory. Only `SMOKE_TG_ID` may differ; missing/differing runtime keys, malformed JSON or inspection/rendering failure stop at a manual checkpoint without printing values. A changed app secret must be reconciled before the current env can serve as rollback evidence. GHCR rejects this partial state.

Phase markers in `.deploy/image-bundle-phase` are `verified → loaded → backed-up → migrated → activated → smoke-passed`, with failure/recovery markers as applicable. They are evidence hints, not proof of current state. Direct helper retries at `verified`/`loaded` revalidate old runtime; workflow reruns still refuse existing SHA staging. `backed-up`, `migrated`, unfinished activation and `rolled-back` require manual recovery review. Same-SHA `smoke-passed` retry verifies checkout and exact healthy runtime without changing previous history; an already-live target without that completed marker fails closed.

A completed `smoke-passed A` permits a later fast-forward B only while checkout, manifest and healthy runtime still agree on A; A becomes B's rollback target. A healthy GHCR SHA is also supported as previous runtime: preserve its exact GHCR image references and require all three images locally, without pulling or inventing local aliases. Reserved operation statuses 124/137/143/255 record `interrupted`, preserve the exit status and block automatic reset/restart or retry until manual audit.

For `image-bundle X → GHCR A → image-bundle B`, the old completed X marker is accepted only when `.deploy/ghcr-manual-phase` records `activated A`, checkout/manifest/exact live/public health agree on GHCR A, and X is an ancestor of A (A must then be an ancestor of B). This handoff preserves A's exact GHCR rollback images. An unfinished image phase, unfinished/mismatched GHCR phase, wrong live reference or unrelated ancestry still stops before import/backup.

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

R0.7 split pricing changes the application rollback boundary. A fixed-only runtime treats `split.price=0` as free and is unsafe once any split event exists. A disabled `EVENT_SPLIT_PRICING_ENABLED` only prevents creation; it does not make existing split data compatible. Full web/bot images carry `org.volleytime.event-split-pricing=1`; the helper independently checks immutable image identity, full SHA tag and OCI revision. A supplied capability label alone is never compatibility evidence.

Both deploy helpers use the same `.deploy/image-bundle.lock` for explicit rollback and controlled migration, activation, readiness and external-smoke recovery. Under this lock `verify-split-rollback.sh WEB_IMAGE BOT_IMAGE CAPTURED_RUNTIME_FILE` captures actual running web/bot IDs, immutable images, references, revision/capability and project/service identity, including duplicate/scaled writers. The staged `capture-split-writer-network.py` validates the direct `postgres:5432/volleytime` URL and exclusive IPv4/IPv6 ownership on PostgreSQL's same local bridge; host/shared/NAT/published-DB or ambiguous ownership fails closed without printing environment values. It rejects `postgres` ExtraHosts overrides and custom DNS configuration, and inspects all attached network members to prove `postgres` resolves solely to the captured PostgreSQL identity; normal frontend+backend web/bot topology is supported. The guard stops all project web/bot writers and proves none is running. Docker stop alone does not prove queued PostgreSQL transactions finished: fresh post-stop `pg_stat_activity` discovery covers the complete owned address set, including connections opened after capture. Targeted PostgreSQL16 `pg_terminate_backend(pid,10000)` waits for actual backend exit (30s statement bound), followed by explicit absence proof; unrelated addresses/sessions are not terminated. Only then does the existing PostgreSQL Compose service query `events.price_mode` schema/split rows authoritatively. Early absence of split rows is insufficient. Query errors and malformed results fail closed.

Private snapshots live in mode-0700 `.deploy/.split-recovery.*` directories; `runtime`, `runtime.network`, optional `runtime.recovery-network`, `git-sha`, `manifest`, `env` and, for GHCR, previous history record the exact recovery boundary. Do not print private env contents. Before the guard succeeds, Git, active manifest/env/history and image activation remain unchanged. Repeat `recheck CAPTURED_RUNTIME_FILE` immediately before source/config switch and before old activation: prove both writer and owned backend absence again and reject address reuse. Hold writers stopped until activation completes, retaining the lock through readiness/recovery. This is a short controlled rollback pause; normal user flows need no new global lock or persisted capability table.

Pre-stop failure retains the current runtime. Post-stop incompatibility/query failure starts only captured current container IDs after validating their immutable image and full revision again; fixed-only captured images can restart only after a successful quiescent no-split query. If any captured image is unsafe or any required identity is missing, recovery stops at the manual checkpoint. An old activation failure first restores exact boundary Git/manifest/env/history, then attempts only this captured compatible current recovery. Compose may have removed captured containers; in that case automatic recovery is deliberately refused, with exact source/config/snapshot locations for a reviewed roll-forward. Never start old unsafe fallback images, infer compatibility from a flag, delete split events/payments, or restore the DB to bypass the guard. Preserve snapshots, local images, backup and actual phase (`rollback-denied` or `rollback-recovery-failed`) for the read-only audit.

Recovery additionally captures network ownership of any running current/partial old-activation writers before stopping them. Unique private `runtime.recovery-network.XXXXXX` files survive failed attempts; every saved additional backend set plus the original captured set is validated and drained on every retry before restarting any writer. Unknown ownership, address reuse, termination timeout or failed absence proof leaves the exact-state manual checkpoint; it never broad-terminates a user/database or restores DB data. Validator checks remain active even when Python optimization is enabled.

The creation capability is rendered from the nonsecret GitHub repository variable `EVENT_SPLIT_PRICING_ENABLED`, enabled only by exact `true`; unset or any other value renders `false`. Keep it disabled until all six feature dependencies, Task 7 local review/exact-head CI, integrated-main five gates/whole-branch review/exact-main CI and runner image-bundle evidence pass. Then promote reviewed main by fast-forward to prod and enable the complete release using the approved rollout sequence. Local tests do not prove VPS stop behavior, real image labels, Telegram delivery or pilot acceptance.

v0.2.0 multi-seat booking (Task 20.1.2, migration `0025_multi_seat_booking`) adds `bookings.seats`, `waitlist_seats`, `incarnation`, `payments.booking_incarnation` and `seat_released_at` with constant defaults, a backfill and two compatibility triggers; the previous runtime keeps working on the new schema while every booking holds one seat. Writing more than one seat is enabled only by exact `EVENT_MULTI_SEAT_ENABLED=true`; the release task 20.7.1 renders the variable and extends this quiescent guard with `SELECT EXISTS (SELECT 1 FROM bookings WHERE seats > 1 OR waitlist_seats > 0)` and the image capability label `org.volleytime.event-multi-seat` ([v0.2.0 release flags](#v020-release-flags-and-rollback-guard-task-2071)); keep it unset (false) until that section allows enabling. Once such rows exist, a runtime without multi-seat support counts occupancy with `count(*)` and is unsafe; do not roll back to it or apply `packages/db/rollback/0025_multi_seat_booking.sql` while the query returns true.

v0.2.0 event join mode and invites (Task 20.1.3, migration `0026_event_join_mode_invites`) adds `events.join_mode` (constant DEFAULT `'open'`), `bookings.invite_id`, the FK `invite_links.event_id → events` with the CHECK `(type = 'event_join') = (event_id IS NOT NULL)`, and the table `event_invite_requests`; the previous runtime keeps working on the new schema while every event is `open`. Writing `join_mode = 'invite'` (event or group default) is enabled only by exact `EVENT_INVITE_MODE_ENABLED=true`; the release task 20.7.1 (item 7, owner decision 2026-10-15) renders the variable and extends this quiescent guard with the image capability label `org.volleytime.event-invite-mode` ([v0.2.0 release flags](#v020-release-flags-and-rollback-guard-task-2071)); keep it unset (false) until that section allows enabling. The guard query is `SELECT EXISTS (SELECT 1 FROM events WHERE join_mode = 'invite' AND status NOT IN ('cancelled', 'finished')) OR EXISTS (SELECT 1 FROM invite_links WHERE type = 'event_join' AND NOT is_revoked AND (expires_at IS NULL OR expires_at > now()) AND (max_uses IS NULL OR uses_count < max_uses))`; before Promote `SELECT id FROM organizations WHERE default_join_mode = 'invite'` must return 0 rows. Once such events or live event links exist, a runtime without invite support lets any member book them (or would accept a link in redeem, at most as a pending application since event links carry `default_member_status = 'pending'`); do not roll back to it while the query returns true. `packages/db/rollback/0026_event_join_mode_invites.sql` refuses with the same predicate and deletes `event_join` invite links. v0.2.0 event series (Task 20.2.2, migration `0027_event_series`) adds the table `event_series` (enum `event_series_status`, unique `(organization_id, idempotency_key)`), nullable `events.series_id` (FK `ON DELETE SET NULL`) and `events.series_date`, `UNIQUE (series_id, series_date)` and the CHECK `series_id IS NULL OR series_date IS NOT NULL`. Series dates are ordinary `events` rows, so the previous runtime reads, edits and cancels them unchanged: by owner decision (D-04 (C), 2026-10-15) there is no feature flag, no application rollback guard extension and no capability label (release task 20.7.1, item 8 verifies the old runtime on the candidate). `packages/db/rollback/0027_event_series.sql` refuses while `SELECT EXISTS (SELECT 1 FROM event_series)` returns true, because it would drop the series rules and templates; deleting series is an operator decision after `pg_dump -t event_series` and keeps events and bookings. v0.2.0 notification feed (Task 20.3.2, migration `0029_notifications_feed`) adds the table `notifications` (enums `notification_type`, `notification_delivery_status`; `UNIQUE (recipient_user_id, dedup_key)`), nullable `users.quiet_hours_start/end` (CHECK `0..1439`, both or neither) and `users.bot_blocked_at`; it is additive, and the previous runtime ignores the new columns and table. `packages/db/rollback/0029_notifications_feed.sql` refuses while `SELECT EXISTS (SELECT 1 FROM notifications) OR EXISTS (SELECT 1 FROM users WHERE quiet_hours_start IS NOT NULL)` returns true, because the feed history and quiet hours cannot be recovered. Procedure when a rollback is needed anyway (operator decision): `pg_dump -t notifications` to a file outside the container, then `DELETE FROM notifications; UPDATE users SET quiet_hours_start = NULL, quiet_hours_end = NULL;`, then the rollback in one transaction (below). `users.bot_blocked_at` does not block the rollback. Apply rollback scripts (0025, 0026, 0027, 0029) only as one transaction that stops on the first error: `psql -v ON_ERROR_STOP=1 -1 -f packages/db/rollback/<tag>.sql` (or `pnpm db:rollback`, which runs the script and the journal delete in one transaction).

v0.2.0 Telegram chat link (Task 20.3.4, migration `0031_telegram_chat_link`) adds the enum `telegram_chat_link_status` and the tables `organization_telegram_chats` (partial unique indexes `WHERE status <> 'unlinked'` on `telegram_chat_id` and on `organization_id`, CHECKs on `chat_type`, `invalid_reason` and `unlink_reason`) and `telegram_chat_link_codes` (SHA-256 of a one-time code, 15-minute TTL). It is additive and the previous runtime neither reads nor writes these tables, so by the same reasoning as event series (rule 4 of the ADR v3 compatibility rules) there is no feature flag, no extension of the application rollback guard and no capability label; release task 20.7.1, item 11 verifies the old runtime on the candidate. New runtime behavior is reachable only through an organizer-issued code: the bot accepts `/link <code>` in a group from a chat administrator and handles `my_chat_member` in groups; an announcement posts only to a linked, valid chat. `packages/db/rollback/0031_telegram_chat_link.sql` refuses while `SELECT EXISTS (SELECT 1 FROM organization_telegram_chats WHERE status <> 'unlinked')` returns true, because a link cannot be restored without a new code and a chat administrator; unlinked history rows and unused codes do not block it. Procedure when a rollback is needed anyway (operator decision): `pg_dump -t organization_telegram_chats` to a file outside the container, `UPDATE organization_telegram_chats SET status = 'unlinked', invalid_reason = NULL, unlink_reason = 'organizer', unlinked_at = now() WHERE status <> 'unlinked'`, then the rollback in one transaction (`pnpm db:rollback`, below). Production wiring is owner work (20.7.1, item 11): group announcements use `https://t.me/<bot>?startapp=event_<id>` buttons, which open the Mini App only when BotFather has the bot's main Mini App configured, and the bot must be allowed to join groups. Apply rollback script 0031 together with 0025, 0026, 0027 and 0029 only as one transaction that stops on the first error.

The SHA argument identifies the **failed candidate**, not an arbitrary target. After a read-only audit confirms eligibility, run the helper preserved in that candidate's staging:

```bash
cd /opt/volleytime
bash .deploy/incoming/FULL_CANDIDATE_SHA/scripts/deploy-image-bundle.sh rollback FULL_CANDIDATE_SHA
```

Only matching `activated`/`smoke-passed` phases are eligible. The helper verifies candidate checkout, clean tracked `prod`, old ancestor commit, previous pointer/manifest/env snapshot, local old images and explainable runtime tags. After the quiescent authoritative guard above succeeds, it restores old Git, exact SHA manifest and saved env, starts old web/bot with `--no-build`, and checks old web/bot/DB/public health. It does not build or pull images.

A controlled backup failure does not advance Git. Controlled migration, activation and readiness failures all enter the same quiescent compatibility guard before any downgrade. Migration recovery restarts only captured unchanged writers after restoring source/config. Old source/runtime recovery is allowed only when authoritative data and image compatibility permit it; otherwise retain/recover compatible current runtime and report the exact state for roll-forward. Actions requests rollback after external smoke only when activation succeeded and smoke explicitly reported a controlled failure. Transport errors, smoke timeout, ambiguous remote state and failed rollback require manual audit; they must not be reported as successful releases.

**Database migrations are not automatically reversed.** R0 production migrations must be forward-compatible and remain backward-compatible with the previous application. A destructive migration needs a separately reviewed database recovery plan and tested restore. Historical local-build rollback/rebuild commands are not recovery commands for this path.

## v0.2.0 release flags and rollback guard (Task 20.7.1)

Release task 20.7.1 (items 5–9, 11) wires the v0.2.0 capabilities the same way as `EVENT_SPLIT_PRICING_ENABLED`. Every flag is a **nonsecret GitHub repository variable**; the Deploy step «Prepare production env» passes it from `vars.*` (owner decision 2026-10-26, [decision log](../decisions/2026-10-12-reference-v3-decisions.md)) and `scripts/render-production-env.mjs` writes it into `.env.production`. Web and bot receive it through `env_file: .env`; Compose does not change.

| Repository variable             | Rendered value                                                                                   | Enables (owning task)                                                 | Image capability label             |
| ------------------------------- | ------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------- | ---------------------------------- |
| `EVENT_BALANCE_ENFORCED`        | exact `true`, otherwise `false`                                                                  | debiting the event balance on publish (20.2.1)                        | none (ADR v3 compatibility rule 5) |
| `EVENT_MULTI_SEAT_ENABLED`      | exact `true`, otherwise `false`                                                                  | bookings with more than one seat (20.1.2)                             | `org.volleytime.event-multi-seat`  |
| `EVENT_INVITE_MODE_ENABLED`     | exact `true`, otherwise `false`                                                                  | `join_mode = 'invite'` for events and group defaults (20.1.3)         | `org.volleytime.event-invite-mode` |
| `SCHEDULER_ENABLED`             | exact `true`, otherwise `false`                                                                  | scheduler loop, `booking_opens_at`, waitlist offers with TTL (20.3.1) | `org.volleytime.event-scheduler`   |
| `TELEGRAM_LOGIN_WIDGET_ENABLED` | exact `true`, otherwise `false`                                                                  | Telegram Login Widget on `/auth/login` (20.5.1, D-05)                 | none (no data, see below)          |
| `SCHEDULER_INTERVAL_MS`         | unset → `15000`; an integer `1000`–`60000`; anything else stops the render before any VPS access | scheduler pass interval (read only while `SCHEDULER_ENABLED=true`)    | —                                  |

The **first v0.2.0 rollout leaves all five flags unset (false)**: the release is deployed with balance debiting, multi-seat writes, invite mode, the scheduler and the Telegram Login Widget off.

**Owner rollout rules (2026-10-26).** Flags are enabled **one at a time**, each with its own release commit on `main` and the owner's explicit confirmation. Once multi-seat, invite or scheduler data exists, an application rollback to v0.1.7 is refused and the only recovery is a roll-forward to a new release.

**How a flag change takes effect.** The env is rendered only by a Deploy run, so changing a repository variable does nothing until the next image-bundle deployment of a **new** `prod` SHA installs the candidate env after the backup. Promote never redeploys the SHA already on `prod`; enable a flag together with the next reviewed `main` SHA (for example the release evidence commit of 20.7.1, item 4). The GHCR path requires the staged env to be byte-identical to the live env, so a flag change goes only through image-bundle. Do not edit `/opt/volleytime/.env` by hand: before the next import `verify-live-rollback-env.sh` compares the live web/bot `Config.Env` with the previous Compose rendering and current `.env`; a flag changed in `.env` without recreating the containers (or a container missing a rendered key) stops that deployment at the manual checkpoint (key-set or value mismatch). The guard itself needs no change for the new keys: they are ordinary `.env` keys present in both the live containers and the rendering. After a rollout, read the effective flags without printing env through the authenticated organization endpoint `GET /api/organizations/{orgId}` → `capabilities.eventMultiSeat`, `eventInviteMode`, `eventScheduler`.

**Rollback guard.** Full v0.2.0 web and bot runtime images carry `org.volleytime.event-split-pricing`, `org.volleytime.event-multi-seat`, `org.volleytime.event-invite-mode` and `org.volleytime.event-scheduler`, each `"1"`. Under the deploy lock, after writers stop and their PostgreSQL backends are drained, `verify-split-rollback.sh` checks every capability: if its schema exists and the data query below returns true, **both** target images must carry the label, otherwise the downgrade is denied (`<capability> rows require compatible web and bot images`) and only the captured current writers are restarted. A schema without the migration needs no label (the target runtime is the one that ran on it). A partially present capability schema, a query error or a malformed result fails closed; a captured current writer without a label restarts during recovery only after the same quiescent query proves no such rows. Labels alone are never compatibility evidence: image ID, full SHA tag and OCI revision are verified first. Every schema and data query runs as `SET search_path TO pg_catalog, public; SELECT …`, so a `"$user"` or other schema earlier in the role's search_path cannot shadow the public tables; the guard strips one leading `SET` tag line and then accepts exactly `t` or `f`.

| Capability    | Data a runtime without it misreads                                                                                                                                                                                                                                                               |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `split`       | `SELECT EXISTS (SELECT 1 FROM events WHERE price_mode='split')`                                                                                                                                                                                                                                  |
| `multi-seat`  | `SELECT EXISTS (SELECT 1 FROM bookings WHERE seats > 1 OR waitlist_seats > 0)`                                                                                                                                                                                                                   |
| `invite-mode` | `SELECT EXISTS (SELECT 1 FROM events WHERE join_mode = 'invite' AND status NOT IN ('cancelled', 'finished')) OR EXISTS (SELECT 1 FROM invite_links WHERE type = 'event_join' AND NOT is_revoked AND (expires_at IS NULL OR expires_at > now()) AND (max_uses IS NULL OR uses_count < max_uses))` |
| `scheduler`   | `SELECT EXISTS (SELECT 1 FROM waitlist_offers WHERE status = 'offered') OR EXISTS (SELECT 1 FROM events WHERE booking_opens_at > now() AND status IN ('draft', 'published', 'closed'))`                                                                                                          |

The previous production runtime (v0.1.7 images) carries only the split label. Once multi-seat, invite or scheduler data exists, the guard refuses an application rollback to it; the recovery is a reviewed roll-forward. A disabled flag does not make existing data compatible. Run read-only checks on the VPS through the existing PostgreSQL service:

```bash
cd /opt/volleytime
docker compose -f docker-compose.prod.yml --env-file .env --env-file .env.images exec -T postgres \
  psql -U volley -d volleytime -v ON_ERROR_STOP=1 -Atc "<query>"
```

### Before Promote of v0.2.0

- Item 7: `SELECT id FROM organizations WHERE default_join_mode = 'invite'` must return 0 rows. The column comes from migration `0021_group_settings_v3`; if `SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='organizations' AND column_name='default_join_mode')` returns `f`, the check passes trivially. Record the result with the release evidence.
- Confirm that the repository variables `EVENT_BALANCE_ENFORCED`, `EVENT_MULTI_SEAT_ENABLED`, `EVENT_INVITE_MODE_ENABLED`, `SCHEDULER_ENABLED` and `TELEGRAM_LOGIN_WIDGET_ENABLED` are unset or not exactly `true` (`gh variable list --repo trafficolog/volleytime`; names and values are nonsecret).
- After activation, inspect both runtime images and record the four capability labels with the image evidence: `docker image inspect --format '{{json .Config.Labels}}' "$(sed -n 's/^WEB_IMAGE=//p' .env.images)"` (same for `BOT_IMAGE`).

### Event balance (item 5, `EVENT_BALANCE_ENFORCED`)

1. Deploy the full release with the flag unset: publishing does not debit; refunds on cancellation need an existing `spend` and are unaffected.
2. From the migrator container of the deployed release, run the reconciliation report without `--apply` and review it (the operator email must belong to an active root admin; it is attribution, not authentication). `ROOT_EMAIL` is the email of the operator's own active root admin account (`users.is_root_admin`); it is recorded as the author in the balance journal and `audit_log`, and it is not in `.env` or GitHub. Set it only in the operator's SSH shell, and confirm it first with the read-only query `SELECT email FROM users WHERE is_root_admin AND is_active` through the PostgreSQL service above. The command refuses an email that is not an active root admin (`forbidden.root_only`). Locally the same command is `pnpm db:event-balance reconcile --operator "$ROOT_EMAIL"`; the migrator image has no package manager at runtime, so on the VPS call the bundled `tsx` directly:

   ```bash
   cd /opt/volleytime
   ROOT_EMAIL='operator@example.com' # replace with your own root admin email
   docker compose -f docker-compose.prod.yml --env-file .env --env-file .env.images \
     run --rm --no-deps --pull never migrate \
     node ./node_modules/tsx/dist/cli.mjs src/event-balance-operator.ts reconcile --operator "$ROOT_EMAIL"
   ```

   The report lists projection drift against the journal, organizations without a starting grant (neither `demo_grant` nor `pilot_grant`: created by a runtime without the balance) and published events without a debit since `--since` (default: the first `pilot_grant`, i.e. migration 0024). Events published while the flag is off are expected in that list and are not debited retroactively (D-12); drift requires investigation before enabling.

3. By operator decision, rerun the same command with `--apply`: it grants the demo quota only to organizations without a starting grant (audit action `event_balance.demo_reconciled`). Drift and unspent events are corrected only by explicit `correct` commands with a comment.
4. Enable `EVENT_BALANCE_ENFORCED=true` only after the full release is deployed, smoke-passed and the report is reviewed, with the next Promote (see «How a flag change takes effect»).

There is no balance capability label and no guard extension (ADR v3 compatibility rule 5): a runtime without the balance, or v0.2.0 with the flag off after a rollback to its saved env, creates events without `spend` and does not corrupt data. After a roll-forward, run `reconcile` with `--since <ISO time the flag was enabled>`: events published by the rolled-back runtime appear as unspent, and organizations it created appear without a starting grant; fix them with `--apply` (demo quota) and `correct` by operator decision. Such events get no refund on cancellation because no `spend` exists.

### Multi-seat bookings (item 6) and invite mode (item 7)

Enable `EVENT_MULTI_SEAT_ENABLED` and `EVENT_INVITE_MODE_ENABLED` only after the full release is deployed and smoke-passed, and only after the rollback guard above has been verified on the candidate (CI fake-shell and real-PostgreSQL guard evidence plus the recorded image labels). The flags only gate writes; after the first such row exists the previous runtime is no longer a rollback target.

### Telegram Login Widget (20.5.1, `TELEGRAM_LOGIN_WIDGET_ENABLED`)

Wired by owner decision 2026-10-26 ([decision log](../decisions/2026-10-12-reference-v3-decisions.md)): `scripts/render-production-env.mjs` renders `TELEGRAM_LOGIN_WIDGET_ENABLED="true"` only for the exact value `true` (otherwise `"false"`; `1`, `TRUE` and padded values render `false`), and the Deploy step «Prepare production env» passes it from `vars.TELEGRAM_LOGIN_WIDGET_ENABLED`. It stays off until the owner explicitly decides to turn it on.

- **Runtime, not build time.** Only the web process reads it, on every `GET /api/auth/login-options` request (`process.env` in the Nitro handler; the bot token's numeric prefix is the public `bot_id`) and at startup (`00.config-check`). It is not in Nuxt `runtimeConfig`, so no build argument or `NUXT_PUBLIC_*` variable is involved and the image is not rebuilt. Web receives it through `env_file: .env`; Compose does not change.
- **Prerequisites.** BotFather `/setdomain` → production bot → `volleytime.by` (done by the owner, 2026-10-26). Caddy CSP already allows `https://telegram.org` and `https://oauth.telegram.org`.
- **Turning it on.** Set the repository variable to exactly `true` (`gh variable set TELEGRAM_LOGIN_WIDGET_ENABLED --body true --repo trafficolog/volleytime`) immediately before the Promote of the next reviewed `main` SHA; as with the other flags (see «How a flag change takes effect») nothing happens until a Deploy of a **new** SHA recreates web with the rendered env. Do not edit `/opt/volleytime/.env` by hand.
- **Checks after the Deploy is `smoke-passed`.** `curl -s https://volleytime.by/api/auth/login-options` returns `{"telegramWidget":{"botId":<number>}}` (no token; `null` means the flag did not arrive). `https://volleytime.by/auth/login` shows the «Войти через Telegram» button below the email form. Logging in with a real Telegram account opens the cabinet and the session survives a reload; the email-code login still works.
- **Turning it off / rollback.** Delete the variable (or set it to anything but `true`) and Promote a new SHA: the endpoint returns `telegramWidget: null` and the button disappears. The flag has no stored data, no migration and no capability label. Rolling back to a runtime without the widget is harmless: the old runtime ignores the variable, and `verify-live-rollback-env.sh` compares the previous Compose rendering with the live env, where the key is present on both sides (contract cases in `live-rollback-env-contract.test.ts`).

### Scheduler (item 9, `SCHEDULER_ENABLED`)

The scheduler loop runs inside the web process (Nitro plugin); there is no separate container and no Compose change. Several web instances are safe (`SKIP LOCKED` jobs, per-event advisory locks).

- **Enable** only after the full release is deployed and smoke-passed and the guard is verified, with the next Promote. `SCHEDULER_INTERVAL_MS` stays unset (15 s) unless the owner decides otherwise.
- **Monitor** after enabling: `docker logs --since 1h vt_web 2>&1 | grep '\[scheduler\]'` must show `[scheduler] started` after every web start and no repeating `[scheduler] tick failed`; `SELECT kind, count(*) FROM scheduled_jobs WHERE status = 'failed' GROUP BY kind` (failed deliveries after exhausted retries, `last_error` holds the reason); `SELECT event_id, last_error FROM scheduled_jobs WHERE kind = 'event.close_skipped'` (split events the scheduler could not settle automatically; the organizer settles them manually, the alert is logged once).
- **Turning the flag off** (redeploy with the variable unset; verify on the candidate): the loop does not start. There is no automatic closing (the organizer closes booking; the closing deadline is not enforced), no reminders and no «booking is open» notifications. An already set future `booking_opens_at` still keeps booking closed until that moment, but a new one cannot be set (409 `event.scheduler_disabled`). Active offers hold their seats until they expire and are then closed lazily at the next seat release (the player leaves the waitlist); the previous automatic promotion skips a booking with an active offer. Queued notifications wait for the scheduler to be enabled again; outdated ones are skipped by the relevance check.
- **Rollback.** The application guard checks the `scheduler` predicate above. Migration rollback `packages/db/rollback/0028_event_jobs.sql` refuses with the same predicate; apply it like the other v0.2.0 rollback scripts, as one transaction that stops on the first error.

### Event series (item 8) and Telegram chat link (item 11): candidate checks without flags

Neither adds a flag, a capability label or an application guard extension (owner decisions D-04 (C) and 2026-10-20). Verify on the candidate (20.7.1, items 8 and 11) that the previous **application** runtime works on the new schema:

- Series: with an existing series, the previous runtime reads, edits and cancels series dates as ordinary events. Migration rollback 0027 is allowed only while `SELECT EXISTS (SELECT 1 FROM event_series)` is false; deleting series is an operator decision after `pg_dump -t event_series` (events and bookings stay).
- Chat link: the previous runtime works on the schema with empty and with filled `organization_telegram_chats` and `telegram_chat_link_codes`. Migration rollback 0031 refuses while linked chats exist (see the chat link paragraph above). No new environment variables (`TELEGRAM_BOT_USERNAME`, `BOT_INTERNAL_URL`, `BOT_INTERNAL_SECRET` are reused).

Record these candidate observations in the release evidence; repository tests do not establish them.

## Path B — GHCR (explicit manual alternative)

Use only after immutable-SHA pulls and registry authentication/reachability are verified. Dispatch **Deploy** on `prod` with `deployment_mode=ghcr`. Runner build/push and Git bundle delivery remain source-gated.

The GHCR helper shares the activation lock. Before backup/mutation it requires healthy live web/bot/public health, current manifest, local old images and server checkout to agree, and staged env to be byte-identical to live env. It does not rotate env or repair a partial candidate manifest. It verifies the exact fast-forward bundle, validates backup, snapshots old manifest/history, pulls candidate images through a temporary manifest, advances Git before migration, and starts only web/bot with `--no-build`. Candidate readiness has bounded retries (24 × 5 seconds by default); detached Compose startup alone is not success.

Before bundle fetch, backup or pull, GHCR also reconciles `.deploy/image-bundle-phase`. An absent marker or exact `smoke-passed` marker for the current healthy image release permits advancement. A historical completed image marker requires an exact current `activated` GHCR marker, matching healthy checkout/manifest/runtime and image→GHCR ancestry. Unfinished phases (including `verified`/`loaded`), malformed/unknown markers and mismatched histories stop without backup, pull or Git advancement. Healthy old containers alone do not prove an interrupted image operation finished.

Each GHCR attempt is reserved atomically under `.deploy/incoming/ghcr-FULL_SHA/`, including its helpers, bundle and private env. Existing same-SHA staging is refused. Uploads cannot replace shared helpers or another attempt's files while that attempt holds the activation lock; normal/recovery SSH access remains independent.

Controlled migration/start/readiness failures run the same quiescent split guard before restoring old Git/manifest/history and verifying exact old health; old env remains intact. Incompatible downgrade/query failure retains current source/config/history, with captured compatible runtime recovery or a reviewed roll-forward checkpoint. Reserved timeout/interruption exit codes require manual recovery audit. Existing per-SHA snapshots reject blind same-SHA reuse. External smoke uses the shared workflow smoke; GHCR production acceptance must explicitly retain synthetic auth/forgery/cleanup evidence and must not be inferred from a basic health-only run.

After verified eligible `activated` phase, explicit rollback uses:

```bash
cd /opt/volleytime
bash .deploy/incoming/ghcr-FULL_CANDIDATE_SHA/scripts/deploy-ghcr-manual.sh rollback FULL_CANDIDATE_SHA
```

This restores snapshotted source/manifest/history and restarts locally available old images without a build or pull. Inspect `.deploy/ghcr-manual-phase`, private per-SHA snapshots, PID/lock, schema and exact health on any ambiguous failure. Reachability, real image pulls and this rollback remain unvalidated in production by local fixtures.

## Production acceptance and evidence

Historical `v0.1.4` evidence covers exact HTTPS health, healthy containers, polling, release-local backup/isolated restore and controlled rollback/redeploy. Published `v0.1.5` bot-identity evidence remains separate. Neither proves Task 9.8.10 rollout.

After controlled deployment, save a new evidence record under `docs/operations/qa/` containing the successful Actions run and exact source SHA, server Git SHA, all three image tags/labels, live web/bot and public health SHA, healthy DB, validated backup created before migration, runtime smoke and synthetic-session cleanup. On failure, record actual phase and recovery result without declaring release success.

Only after successful runtime smoke perform [manual Telegram QA](../qa/telegram-miniapp-checklist.md) on test accounts/organization, including Mini App/BotFather/deeplink/initData and organizer/player flows. Tasks 8.7.2/8.8.11 remain separate. Tag/Release `v0.1.6` requires separate user acceptance of Telegram/pilot evidence; do not rewrite published tags. S3 upload/retention/restore, external Sentry/UptimeRobot, repaired webhook ingress and a week of real trainings remain separate R0 acceptance gates.
