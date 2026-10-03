# R0.7 split pricing: code checkpoint and open live acceptance

Task: 9.8.11. Release: v0.1.7 candidate. Date: 2026-10-03. Status: in_progress.

Task 1–6 feature dependencies are accepted on main `ebfc5bf19b2ab514c37ccbc63ca8eb6d03a64c75`; exact-main CI 37133566327 completed all four jobs successfully, including runner image build/export/import. Task 7 implements the local rollback/capability checkpoint only. Its own review, exact-head CI and integrated-main verification precede promotion; no production mutation or release completion is implied.

## Evidence boundaries

Executable fake-Docker shell contracts cover immutable current capture, stop of every Compose project/service writer including duplicate/scaled containers, authoritative PostgreSQL query ordering, absence recheck and captured-current recovery. The Docker daemon, VPS and real container shutdown are not exercised by these harnesses.

Separate PostgreSQL tests use real transactions and explicit barriers. A split write begun before simulated container stop either commits before the authoritative query (fixed-only old target rejected) or rolls back. Additional real PG16 tests leave a dedicated backend alive after the container reports stopped, including a connection opened inside stop after capture: the production drain SQL waits for actual backend exit before querying data, while an unrelated session survives with the same PID. These scoped connections use the verified existing PostgreSQL test container and `volleytime_test`, not production/QA financial data. After stop, the closed runtime connection cannot issue/commit a new request in the guard-to-activation window. No guessed sleep or mock query result supplies DB evidence. Production direct bridge/IPv4+IPv6 ownership, reassignment refusal and additional recovery writers are separate fake-Docker contracts, not actual VPS topology evidence.

Repository five-gate results, exact tested source identity and retained RED/GREEN diagnostics belong to the Task 7 implementer checkpoint report and subsequent exact-head CI/reviews. This document does not substitute for those gates or integrated-main/live evidence. User runtime 3317 was stopped explicitly by the user before any build; the implementer separately verifies no listener immediately before build. No runtime restart or QA financial fixture change is authorized by that stop. Heavy single-operation shell contracts use explicit user-approved35000ms test budgets, with the60000ms multi-operation scenario retained; production PG/Docker/readiness limits and assertions are unchanged.

Applicable local real-API Chrome matrices are already independently accepted: [organizer/desktop Task 4](2026-10-02-organizer-split-chrome.md) on `cad35c35ea7ff0220005b966045d02f743591d72` and [player/landing Task 5](2026-10-02-player-split-chrome.md) on `e4634cd157abaac4742c06ae42d1f007b4c111fc`. These records cover fixed/split/error/stale scenarios, light/dark, 320/390/1280, keyboard/reflow and native 200% affected controls with their explicit limitations. Task 7 changes no product UI or new browser control; retain those exact source/artifact identities as prior accepted evidence. Integrated candidate and real Telegram/pilot acceptance remain separate.

## Remaining acceptance

- Fresh Task 7 specification/code review, exact-head CI and integrated candidate evidence; preserve the accepted organizer/player/desktop Chrome matrix provenance above.
- Task 7 merge with the card still in_progress; exact integrated-main five gates with PostgreSQL, whole-branch review and exact-main CI/runner image-bundle evidence.
- Reviewed fast-forward main → prod, capability enablement for the full candidate and successful Actions image-bundle deployment. Verify dump before migration, gzip/private permissions, Git/all images/runtime exact SHA, DB/web/bot/public health and synthetic auth/forgery smoke with cleanup.
- Two real Telegram test accounts in the pilot organization: roster/forecast/waitlist, manual settlement, personal exact amount delivery, confirm/reject, subscription disabled, repeat settlement without duplicate payments/audits/notifications, light/dark and owner acceptance.
- Only then close 9.8.11/release and create immutable v0.1.7 tag/Release. Historical R0.6 manual acceptance, isolated restore, monitoring and real-group checks require their own evidence.

Use the updated [deploy runbook](../runbooks/deploy.md) if any critical defect occurs. After split data exists, fixed-only downgrade is forbidden; use captured compatible current recovery or a reviewed roll-forward, preserving data and backups.
