# R0.6 production candidate: controlled image-bundle deploy

Task: [9.8.10](../../tasks/9-8-10-registry-free-image-bundle-deploy.md). This is production deployment evidence for the **candidate**, not acceptance of the real Telegram client or the `v0.1.6` release.

## Source and gates

- [PR #70](https://github.com/trafficolog/volleytime/pull/70) merged as `64f18506b03081bc7b9c065c8371cd3e62f10b30`. The merge tree equals the reviewed PR head tree `964747f803730d15460da2753c287031faa73ddc`.
- Exact-head [CI 36745830244](https://github.com/trafficolog/volleytime/actions/runs/36745830244) and exact-main [CI 36746465845](https://github.com/trafficolog/volleytime/actions/runs/36746465845) passed quality, PostgreSQL tests, build and runner image build/export/import. The main image job recorded `RELEASE_SHA=64f18506b03081bc7b9c065c8371cd3e62f10b30`, `ARCHIVE_BYTES=243082802`, `UNPACKED_BYTES=886837248` and loaded web/bot/migrator tags of that SHA. Independent final review found no remaining Critical/Important issue.
- Immediately before promotion, `origin/prod=a16eb2a2f821e5e8f46fd8749f12d571d7aeadf4` was an ancestor of `origin/main=64f1850`; the VPS had a clean tracked `prod` checkout, no image/GHCR phase marker or target staging, a free deploy lock, three old local images, healthy web/bot/PostgreSQL and about 8.1 million KiB free. HTTPS health still reported the old live `67bbfe89acaac04992b8128d45cb1b40f8acc75c`. The historical checkout/candidate-manifest versus live-runtime mismatch was checked before activation; the read-only rollback-env verifier passed against that live state without exposing values.

## Deployment and runtime

- Reviewed `main` advanced `prod` by ordinary fast-forward, without force-push or tag rewrite. Push triggered [Deploy run 36747623989](https://github.com/trafficolog/volleytime/actions/runs/36747623989) for exactly `64f1850`; source gate, pre-deploy tests, runner build, capacity check, bounded transfer, activation, external smoke and confirmation all passed. No Docker build or server-side GitHub pull ran on the VPS. **Offline-VPS acceptance is not met:** during the one-off migrator container run, Corepack downloaded `pnpm@12.4.1` from `registry.npmjs.org` at 17:03:45–17:03:46 UTC. Docker `--pull never` did not block this application-level download. The migration succeeded, but a future deploy could fail without npm access.
- Workflow log: `verified` at 17:01:21 UTC, three images loaded by 17:03:21, `backed-up` at 17:03:32, migrations applied at 17:03:51, `migrated` at 17:03:57, `activated` at 17:04:17 and `smoke-passed` at 17:05:08. Caddy and PostgreSQL were not intentionally recreated.
- Backup `/opt/volleytime/backups/volleytime_20260930_170328.sql.gz` was created before migration; post-deploy `stat` showed mode `0600`, 9,575 bytes, and `gzip -t` passed. This validates this release dump's existence/compression, **not** an isolated restore test or S3 backup.
- Post-deploy VPS tracked checkout is clean `prod=64f1850`; `.env.images` references all three exact-SHA images. All three locally inspected images are `amd64` with OCI revision `64f1850`. `vt_web`, `vt_bot`, `vt_postgres` are healthy; the previous pointer and three-image manifest still identify the actually former live `67bbfe8` for controlled rollback.
- HTTPS [`/api/health`](https://volleytime.by/api/health) returned `status=ok`, `db=ok`, `auth=ok`, release `64f1850` at 17:06:52 UTC. Bot `/healthz` returned `status=ok`, `mode=polling`, release `64f1850`.
- External synthetic smoke returned HTTP 200 for health, session, Telegram sign-in and authorized organizations; forged initData returned HTTP 401. It removed one technical session and logged `SMOKE OK`; `confirm-smoke` recorded `smoke-passed`. The webhook route's HTTP 502 was expected in the current polling fallback, not proof of inbound Telegram webhook availability.

## Still open

- Fix Task 9.8.10's migrator runtime dependency, prove the final image can invoke its CLI with network disabled, pass the gates/review and repeat a controlled exact-SHA deploy with no runtime npm download. The successful `64f1850` rollout alone does not close the task.
- [Real Telegram Mini App checklist](telegram-miniapp-checklist.md) on two test accounts and the pilot organization, including notification delivery and iOS/Android/Desktop client behavior. Repository/Chrome/synthetic checks do not substitute for it.
- Pilot acceptance and any defects discovered there. No `v0.1.6` tag or GitHub Release is created until that separate gate is accepted. If a critical defect appears, stop the pilot and use the [deploy runbook](../runbooks/deploy.md) for an audited recovery decision; do not blindly rerun the workflow.

## Local offline-runtime remediation

RED commits `ee8d752` and `33fd8c0` reproduce the runtime package-manager dependency and missing offline packaging gate. The fix runs the image's copied `tsx` CLI through Node and rejects packaging before `docker save` when the bundled CLI cannot start with `--network none`.

The built final image `volleytime-migrator:offline-qa` started its CLI without networking (`tsx v4.23.13`, Node `v22.23.3`). With its default CMD, it applied all 20 migrations to a fresh PostgreSQL 16 database on a dedicated Docker network created with `--internal`; a second run succeeded and left the migration journal at 20. Network inspect returned `Internal=true`, and an outbound fetch of `https://registry.npmjs.org/pnpm` from the same image/network failed. These are isolated local migration checks; no production mutation or redeploy was performed for this fix.

Fresh local gates passed: `pnpm format:check`, `pnpm lint` (0 errors, 12 baseline warnings), `pnpm typecheck` (6/6), `pnpm test` with PostgreSQL (130 files, 884 tests; 418.12 seconds) and `pnpm build` (2/2). Bash syntax for the changed packaging helper and `git diff --check` passed. The earlier focused offline/deploy contracts passed 101/101. Author self-review and independent scoped review of `64f1850..46b248e` found no Critical/Important blocker; the review also checked unchanged Compose/deploy command overrides and migration imports. Updated exact-head/main CI and controlled corrected deployment remain required. The final migration image was `amd64`, ID `sha256:26d80b300ca2f5e3519411c6db7e1856b1fe52d1aa9a1c0663bbeef28e8a90e3`.
