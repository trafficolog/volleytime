# Coding standards — Volley Time

Read this document before implementing, reviewing or integrating changes. For the ordered SDD/TDD workflow and card statuses, follow [DEVELOPMENT_PROCESS](docs/DEVELOPMENT_PROCESS.md).

## Implementation boundaries

- Implement the owning task's acceptance criteria and respect its exclusions. Take current release scope from [RELEASES](docs/RELEASES.md), not from design exports or historical MVP phase lists.
- Use the simplest solution that satisfies the task (KISS). Share reused behavior in `packages/shared` or the relevant package (DRY); consider abstraction no earlier than the third repetition. Resolve DRY/YAGNI conflicts in favor of YAGNI: duplication is cheaper than a premature abstraction.
- Treat Claude Design exports as UI references, not business/domain requirements. Future screens do not expand the current release.

## Git and review

- One task per branch from `main`: `trafficolog/<type>/<id>-<slug>`, where type is `feat`, `fix`, `test`, `docs` or `chore`.
- Use Conventional Commits with `Task: <id>` and `Release: <version>` trailers; select the version from RELEASES.
- Create a PR into `main`, linking the task and closing its issue when one exists. Merge after task acceptance, review findings and applicable CI gates are satisfied.
- Preserve published release tags. Production promotion and rollback follow the [deploy runbook](docs/operations/runbooks/deploy.md), separately from task merge into main.

## Verification and evidence

For code-affecting changes, run each required gate and record its result on the tested source revision:

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

These are required gates, not a cached description of scripts. Read `package.json`, test configuration and workflow files for their current execution details. Integration tests require PostgreSQL; skipped integration coverage is not a passing integration gate. Record failures, warnings and coverage limitations alongside results.

For documentation-only changes, verify changed-document formatting, local links and consistency of the affected rules; applicable CI still applies. This does not relax code or production gates.

Production-impacting changes additionally require the owning task's smoke checks and the deploy runbook. Telegram QA, deploy, backup/restore, monitoring and real-group acceptance require their respective observed evidence; repository tests alone do not establish them.
