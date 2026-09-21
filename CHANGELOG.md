# Changelog

All notable release-level changes are recorded here. Detailed task history lives in `docs/tasks/` and `docs/RELEASES.md`.

## [v0.1.4] — 2026-09-21

- add prod-only exact-SHA deployment through a verified Git bundle and local VPS build;
- provision a dedicated restricted GitHub Actions key and fail-closed production Secrets;
- create and validate a local PostgreSQL backup before checkout advancement and migrations;
- publish deterministic SHA-tagged web/bot images and release identity in health endpoints;
- add polling as the production Telegram fallback while provider IPv4 webhook ingress is unavailable;
- add explicit ancestor-target rollback with legacy-Compose identity compatibility;
- verify live deploy, smoke, controlled rollback to `v0.1.3` and successful redeploy;
- reconcile production task evidence while preserving manual Telegram, monitoring, S3 and one-week pilot gates.
- publish annotated tag and GitHub Release on final production SHA `16c2fe422db94bc97c085201a6cf9fcc919b7b72` after workflow `35569731828` passed.

No new product scope is introduced.

## [v0.1.3] — 2026-09-19

- synchronize root/status documentation with the implemented MVP;
- publish the canonical release candidate to GitHub;
- standardize release runtime target on Node.js 22;
- execute fresh GitHub CI release gate;
- reconcile R0 SDD status drift: 119 legacy non-done cards → 18 evidence-backed open cards;
- complete Task 4.7.5: Mini App audit log + owner settings/archive UI with red→green TDD;
- implement Task 9.8.2 repository contract: fail-closed production env rendering + protected SCP install before migrate/up;
- document repository-ready vs external production-validation gates.

No new product scope is introduced.

## [v0.1.2] — 2026-09-18

Second-review fixes: four P1 and five P2 findings across UI booking action placement, deployment rollback/rate-limit/webhook/smoke hardening, payment notification wording, manual-income categories, auth response exposure and status documentation.

## [v0.1.1] — 2026-09-17

MVP hardening after the first full review. Closed 21 P0 findings covering production auth/schema behavior, Telegram/webhook runtime, notifications, tenancy/permissions, booking/subscription/payment invariants, deployment, smoke, backups and operational hardening.

## [v0.1.0] — 2026-09-16

Initial coded R0/MVP implementation for phases 3, 4, 5, 6, 8 and 9.
