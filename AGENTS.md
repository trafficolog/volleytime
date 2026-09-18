# Agent Instructions — Volley Time

## Source of truth

1. `docs/DEVELOPMENT_PROCESS.md` — mandatory SDD + TDD process.
2. `docs/tasks/<id>-*.md` — task specification and acceptance criteria.
3. `docs/RELEASES.md` — release scope and Definition of Done.
4. `docs/operations/status/current-state.md` — current implementation/release state.

Do not implement code without an SDD task. If review discovers a product defect, create/sync the task first, then use red → green → refactor.

## Engineering principles

Use **DRY, KISS, YAGNI**. Prefer YAGNI over premature abstraction. Do not pull functionality from future phases into the current release.

Current R0/MVP scope is phases **3, 4, 5, 6, 8, 9**. Phase 10+, credits, automation, online payments, contributions, reports, tournaments and CRM are not part of R0 unless a later release task explicitly says otherwise.

## Git / reviews

- One task per branch (`feat/`, `fix/`, `test/`, `docs/`, `chore/`).
- Conventional commits with `Task:` and `Release:` trailers.
- Do not rewrite published release tags.
- Merge only after the task acceptance criteria and applicable CI gates pass.
- Treat Claude Design exports as UI references, not as business/domain source of truth.

## Required verification

For code-affecting changes run, at minimum:

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Integration tests require PostgreSQL. Production-impacting changes additionally require the relevant smoke/runbook checks.

Never claim Telegram QA, production deploy, backups/restore, monitoring or real-group validation from repository tests alone.
