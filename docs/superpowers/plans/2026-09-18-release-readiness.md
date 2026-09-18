# Volley Time v0.1.3 Release Readiness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish the current MVP codebase to the canonical GitHub repository, remove release-status documentation drift, and establish evidence for a production release decision without expanding MVP scope.

**Architecture:** Treat `main@v0.1.2` from the supplied repository archive as the implementation source of truth, and the Claude Design export as a UI reference only. Release-readiness changes are documentation/operations changes; any newly discovered product defect must receive its own SDD task and TDD fix before merge.

**Tech Stack:** Git, GitHub Actions, pnpm/Turborepo, Nuxt 4, grammY, Drizzle/PostgreSQL, Docker/Caddy.

**Spec:** `docs/tasks/9-11-1-release-readiness.md`

## Global Constraints

- SDD + TDD from `docs/DEVELOPMENT_PROCESS.md`.
- DRY · KISS · YAGNI; do not add Phase 10+ functionality.
- R0/MVP scope remains phases 3, 4, 5, 6, 8, 9.
- Do not mark real-Telegram QA, first VPS deploy, backups, monitoring, or one-week real usage as complete without external evidence.
- Preserve existing release tags; `v0.1.2` is immutable.

---

### Task 1: Synchronize release documentation

**Files:**
- Modify: `README.md`
- Modify: `docs/operations/status/current-state.md`
- Modify: `docs/RELEASES.md`
- Create: `AGENTS.md`
- Create: `CHANGELOG.md`
- Create: `SECURITY.md`

**Interfaces:**
- Consumes: release facts from `docs/RELEASES.md`, `docs/operations/reviews/*`, git tags.
- Produces: one consistent description of implemented MVP vs outstanding external release gates.

- [ ] **Step 1:** Record the documentation drift in `docs/tasks/9-11-1-release-readiness.md`.
- [ ] **Step 2:** Update root documentation and current-state snapshot so it agrees with `main@v0.1.2`.
- [ ] **Step 3:** Add `v0.1.3` as release-readiness patch scope only; do not claim production rollout.
- [ ] **Step 4:** Validate links and references with repository grep/static checks.
- [ ] **Step 5:** Commit with `Task: 9.11.1` / `Release: v0.1.3`.

### Task 2: Review code and UI against MVP contracts

**Files:**
- Read: `apps/**`, `packages/**`, Docker/CI files, SDD cards and Claude Design export.
- Create/modify only if a blocking defect is confirmed: a dedicated task + regression test + minimal fix.

**Interfaces:**
- Consumes: R0 Definition of Done, prior review reports, Claude Design reference screens.
- Produces: `docs/operations/reviews/2026-09-18-v0.1.2-release-readiness.md`.

- [ ] **Step 1:** Re-check security-sensitive auth, tenant isolation, payments/ledger, webhook, rollback, smoke and secrets boundaries.
- [ ] **Step 2:** Compare implemented route/screen coverage with the Claude Design reference at element/flow level, not pixel level.
- [ ] **Step 3:** Classify findings as repository blockers, external/manual gates, or intentionally deferred Phase 10+ work.
- [ ] **Step 4:** For any repository blocker, create a separate SDD task and use red→green→refactor.
- [ ] **Step 5:** Write review evidence and outstanding gates.

### Task 3: Publish release candidate and execute CI gate

**Files:**
- GitHub repository: `trafficolog/volleytime`
- Workflows: `.github/workflows/ci.yml`, `.github/workflows/deploy.yml`

**Interfaces:**
- Consumes: reviewed release-candidate tree.
- Produces: GitHub branch/PR plus Actions evidence.

- [ ] **Step 1:** Publish the release-candidate snapshot to an isolated GitHub branch.
- [ ] **Step 2:** Open PR against `main` and let GitHub Actions execute install, lint, format, typecheck, tests and build.
- [ ] **Step 3:** Inspect every failed job; fix only verified causes through SDD/TDD.
- [ ] **Step 4:** Re-run the full gate until green or record a concrete blocker.
- [ ] **Step 5:** Merge only after the gate is green; preserve external/manual production gates as open.

## Self-review

- Spec coverage: documentation consistency, code/UI review, repository publication and CI evidence are covered.
- Placeholder scan: no TBD/TODO placeholders.
- Scope: no Phase 10+, automation, monetization, or new product behavior is included.
