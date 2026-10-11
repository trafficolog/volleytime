# R0.7 / v0.1.7 — production and owner pilot acceptance

Acceptance date: 2026-10-11 (Europe/Minsk). Release source and production runtime: `e293e069dfc637db835c36a477639379c7e2bcb3`. Closure documentation is a subsequent docs-only main revision; it does not require a runtime redeploy. The release tag must identify this exact tested and deployed source, not the later documentation commit.

## Technical publication

- [PR94](https://github.com/trafficolog/volleytime/pull/94) reviewed and merged after [head CI37670224272](https://github.com/trafficolog/volleytime/actions/runs/37670224272); [exact-main CI37670725937](https://github.com/trafficolog/volleytime/actions/runs/37670725937) all four jobs SUCCESS, including PostgreSQL tests and runner image export/import.
- [Deploy37673966652](https://github.com/trafficolog/volleytime/actions/runs/37673966652) completed SUCCESS on exact e293e06. All product sources remained unchanged from the previously reviewed d98ed97 candidate; PR94 changed agent instructions/documentation only.
- Controller post-deploy verification2026-10-07: clean VPS prod Git, three OCI revisions, actual web/bot image IDs, bot/public health and smoke-passed agreed. GitHub main/prod and local prod matched. PostgreSQL healthy, bot polling; web/bot creation capability true and split image labels1.
- New backup `/opt/volleytime/backups/volleytime_20261007_193144.sql.gz`:12097bytes,0600,parent0700,gzip integrity PASS. Workflow backup-ready19:31:48UTC preceded migrations-applied19:32:02UTC; activation19:32:34UTC, smoke-passed19:33:26UTC. This proves dump/archive integrity, not a restore exercise.
- Synthetic health/exactSHA200, auth/get-session200, signed synthetic Telegram login200, authenticated organizations200, forgedinitData401 and fixture cleanup `cleaned=true,userId=4,sessionsRemoved=1`; SMOKEOK. Webhook route502 is the existing non404 polling-mode probe, not functioning webhook ingress evidence.
- Authorized stale build-cache-only cleanup before deploy reclaimed9.169GB. All image/container/volume inventories and backup hashes were unchanged by cleanup; no images, volumes, backup or rollback materials removed. Root free space after deploy9529200KiB. Previous compatible runtime d98ed97 retained.
- Fresh controller public health2026-10-11T18:50:47UTC: status/db/authok, exacte293e06; workflow still completed SUCCESS.

## Manual Telegram evidence — user-observed, not agent browser QA

Two real accounts (organizer and player) and test organization were prepared by the owner. Results below were reported by the user in this chat; the agent did not directly inspect native Telegram UI, personal notifications or payment actions. No screenshots or device logs were supplied for this final matrix.

Platforms confirmed: **Android and Desktop**. User supplied version **7.3.1**; the mapping of that version to an individual client was not specified. Desktop operating system/build, Android OS/device and other client versions are unreported. This is actual platform coverage, not a claim of iOS/Web coverage.

| Scenario requested                                                                                     | User confirmation / observed result reported                                         |
| ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------ |
| Real Mini App entry, invitation and organizer/player roles                                             | “Все готово и корректно работает” after preparing both accounts/group                |
| Published split target10.01BYN/capacity2, both join, forecast before settlement, cash/transfer         | “Подтверждаю” to the full scenario                                                   |
| Personal settled amounts5.01/5.00BYN, exact total10.01, personal notification and two pending payments | Confirmed with the same scenario; each personal amount/notification reported correct |
| Confirm5.01 payment                                                                                    | “Все совпало”: exactly one income5.01 and notification                               |
| Reject5.00 payment                                                                                     | “Все совпало”: reservation removed, other share5.01 unchanged, no extra income       |
| Cancel settled event                                                                                   | “Все совпало”: only paid5.01 refunded, payment history preserved, net cashbox0BYN    |
| Unsettled split capacity1/waitlist/promotion before settlement                                         | “Подтверждаю все пункты” to the four-part follow-up matrix                           |
| Settled joins/target/mode edit refused; subscription unavailable for split                             | Confirmed in the same follow-up matrix                                               |
| Fixed/free/subscription regression, cancel and session restoration                                     | Confirmed in the same follow-up matrix                                               |
| Light/dark and Back on both accounts                                                                   | Confirmed in the same follow-up matrix                                               |
| Repeat settlement/confirm/reject: no duplicate payments, ledger entries or notifications               | Separately asked during final audit; “Да, все корректно”                             |

**Owner pilot acceptance:** user explicitly stated “Приемку подтверждаю”; subsequent platform and repeat confirmations complete this R0.7 pilot matrix. No reported critical defect remains from these scenarios. This acceptance is based on user testimony with the disclosure above, not inferred from CI/synthetic smoke.

## Completion boundaries

Task9.8.11 R0.7 release acceptance is satisfied; publish immutable `v0.1.7` on exact production e293e06 after reviewed closure-docs CI/merge. This report authorizes no extra production mutation, database restore, image removal or unsafe fixed-only rollback.

Historical R0.6-specific manual cards are not automatically marked done. Full original R0/MVP operational acceptance still separately includes S3/retention/restore, external Sentry/UptimeRobot, repaired webhook ingress and a week of real trainings. No claim of those checks, current production rollback execution, full OS/client-version coverage or week-long pilot is made. Deferred tooling minors remain as recorded in the [final code checkpoint](2026-10-05-r07-final-code-checkpoint.md).
