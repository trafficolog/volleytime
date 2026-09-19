# Production Release Automation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish the verified `v0.1.3` baseline and ship `v0.1.4` with automatic, outbound-independent deployment from GitHub `prod` to the VPS.

**Architecture:** GitHub Actions validates `prod`, creates a Git bundle for the exact workflow SHA, and uploads it with a mode-0600 production env and versioned scripts through a dedicated CI SSH key. The VPS validates and fast-forwards from the local bundle, snapshots PostgreSQL, builds SHA-tagged images, migrates, starts, smokes, and can roll back the application revision without reversing the database.

**Tech Stack:** GitHub Actions, Node.js 22, pnpm 12.4.1, Vitest, Git bundle, OpenSSH, Docker Compose, PostgreSQL 16, Caddy.

**Spec:** `docs/superpowers/specs/2026-09-19-production-release-automation-design.md`

## Global Constraints

- GitHub `main` is the development integration branch; only GitHub `prod` may deploy production.
- Implement each SDD task on its own branch from the latest `main`, with Conventional Commit `Task:` and `Release:` trailers and a separate PR.
- The automatic path must not require the VPS to resolve or contact GitHub or GHCR.
- Use a new dedicated Ed25519 CI key; never copy the user's normal or recovery private key into GitHub.
- Never print, commit, attach, or include production secret values in logs or release notes.
- Create and validate a local PostgreSQL backup before checkout advancement and before migrations.
- Production migrations are forward-only and compatible with the immediately preceding application revision.
- Do not configure or close Sentry, UptimeRobot, S3, Telegram manual QA, BotFather acceptance, or the one-week MVP gate without real evidence.
- Before every code PR run `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build`.
- Never move or rewrite an already published release tag.

## Review Focus

- A valid bundle containing a different commit must be rejected before backup, checkout, build, or migration; Task 3 tests exact-SHA rejection.
- A dirty tracked VPS checkout must be rejected while allowing documented untracked runtime paths; Task 3 tests both states.
- A target that is not a descendant of the deployed revision must be rejected instead of resetting production; Task 3 tests non-fast-forward history.
- A failed smoke after a successful migration must restore the prior application SHA and release identity without reversing the database; Tasks 4 and 5 test repository and live behavior.
- A second deployment of the same SHA must be idempotent enough to complete without corrupting `.env.images.previous` or refusing a safe redeploy; Task 4 adds a same-SHA manifest test and Task 5 exercises a redeploy.

---

### Task 1: Integrate the approved design and publish `v0.1.3`

**Files:**

- Modify: `docs/tasks/9-11-3-production-release-design.md`
- Create: `docs/operations/releases/v0.1.3.md`
- Existing: `docs/superpowers/specs/2026-09-19-production-release-automation-design.md`
- Existing: `docs/superpowers/plans/2026-09-19-production-release-automation.md`

**Interfaces:**

- Consumes: verified baseline commit `91f6bffbd005876f94ffd1c31cebb4bcd891a752`.
- Produces: immutable Git tag/GitHub Release `v0.1.3`; merged design and plan on `main` for Tasks 2-6.

- [ ] **Step 1: Add exact baseline release evidence**

Create `docs/operations/releases/v0.1.3.md` with the exact SHA, date, external health result, healthy container list, concrete Telegram IPv6 `2001:67c:4e8:f004::9`, backup filename and successful isolated restore. Include an explicit open-gates list for automatic deploy, Sentry/UptimeRobot, S3, Telegram client QA and one week of real use.

- [ ] **Step 2: Close the design task**

In `docs/tasks/9-11-3-production-release-design.md`, set `status: done`, `sync_state: synced`, and a `status_note` naming the approved spec and plan. Mark all six acceptance checkboxes complete.

- [ ] **Step 3: Verify documentation**

Run:

```bash
pnpm exec prettier --check docs/tasks/9-11-3-production-release-design.md docs/operations/releases/v0.1.3.md docs/superpowers/specs/2026-09-19-production-release-automation-design.md docs/superpowers/plans/2026-09-19-production-release-automation.md
git diff --check
```

Expected: Prettier reports all four files formatted and `git diff --check` prints nothing.

- [ ] **Step 4: Commit the completed design package**

```bash
git add docs/tasks/9-11-3-production-release-design.md docs/operations/releases/v0.1.3.md docs/superpowers/specs/2026-09-19-production-release-automation-design.md docs/superpowers/plans/2026-09-19-production-release-automation.md
git commit -m "docs(release): complete production automation design" -m "Task: 9.11.3" -m "Release: v0.1.4"
```

- [ ] **Step 5: Publish and merge the design PR**

Push `docs/9.11.3-production-release-design`, create a PR to `main`, attach the PR artifact, wait for all CI jobs, and merge only if every required check succeeds. Fast-forward the local `main` reference to the merge commit.

Expected: the PR is merged, GitHub `main` contains the spec/plan, and `prod` still points to `91f6bff`.

- [ ] **Step 6: Create the immutable baseline release**

Verify the target before writing:

```bash
git cat-file -e 91f6bffbd005876f94ffd1c31cebb4bcd891a752^{commit}
git ls-remote --tags origin refs/tags/v0.1.3
gh release view v0.1.3 --repo trafficolog/volleytime
```

Expected before creation: the commit exists; tag and release queries report that `v0.1.3` does not exist.

Create an annotated tag exactly at the verified baseline, push only that tag, and create the GitHub Release using `docs/operations/releases/v0.1.3.md` as notes:

```bash
git tag -a v0.1.3 91f6bffbd005876f94ffd1c31cebb4bcd891a752 -m "Volley Time v0.1.3"
git push origin refs/tags/v0.1.3
gh release create v0.1.3 --repo trafficolog/volleytime --verify-tag --target 91f6bffbd005876f94ffd1c31cebb4bcd891a752 --title "Volley Time v0.1.3" --notes-file docs/operations/releases/v0.1.3.md
```

Read back the tag target and release URL. Expected: both resolve to `91f6bffbd005876f94ffd1c31cebb4bcd891a752`.

### Task 2: Task 9.8.6 — dedicated GitHub Actions credentials

**Files:**

- Create: `docs/tasks/9-8-6-github-actions-production-credentials.md`
- Modify: `docs/operations/runbooks/deploy.md`
- Test: `apps/web/server/utils/deploy-contract.test.ts`
- External: GitHub repository Secrets; `/home/deploy/.ssh/authorized_keys`; local protected key directory.

**Interfaces:**

- Consumes: workflow secret names `VPS_HOST`, `VPS_SSH_KEY`, and the required keys accepted by `scripts/render-production-env.mjs`.
- Produces: dedicated key files `volleytime-github-actions` and `.pub`; GitHub Secrets ready for Tasks 3-5; documented key rotation/revocation procedure.

- [ ] **Step 1: Create the SDD card on a new branch**

From updated `main`, create `chore/9.8.6-github-actions-production-credentials`. Add the task card with exact acceptance criteria: dedicated key, restricted authorized-key entry, required secret names present, no values logged, existing normal/recovery access retained, and CI-key revocation documented.

- [ ] **Step 2: Write the failing contract test**

Extend `deploy-contract.test.ts` with a test that requires the runbook to contain all of:

```ts
expect(runbook).toContain('volleytime-github-actions')
expect(runbook).toContain('restrict')
expect(runbook).toContain('VPS_SSH_KEY')
expect(runbook).toContain('volleytime-recovery')
expect(runbook).toContain('revoke')
```

- [ ] **Step 3: Run the focused test and observe RED**

Run:

```bash
pnpm vitest run apps/web/server/utils/deploy-contract.test.ts
```

Expected: FAIL because the runbook does not yet document the dedicated key lifecycle.

- [ ] **Step 4: Document the minimal credential procedure**

Update the runbook with the exact key name, `restrict` authorized-key prefix, repository Secret names, verification commands that reveal only names/status, independent tests for the normal and recovery keys, and removal of only the CI public-key line during revocation.

- [ ] **Step 5: Run the focused test and observe GREEN**

Run the same Vitest command. Expected: the new test and existing deploy contract tests pass.

- [ ] **Step 6: Provision the dedicated key without exposing it**

Generate an Ed25519 key at `D:\ai\freelance\keys-vps\volleytime-github-actions` with comment `github-actions@volleytime`. Refuse to overwrite an existing file. Append only the public key to `deploy`'s `authorized_keys` with the `restrict` option and mode `0600`.

Expected: authentication succeeds with the CI private key; the existing `volleytime` and `volleytime-recovery` keys still authenticate; no private-key material appears in command output.

- [ ] **Step 7: Populate and verify GitHub Secrets**

Upload `VPS_HOST=185.185.69.136`, the dedicated private key as `VPS_SSH_KEY`, and the ten required production environment values from `/opt/volleytime/.env`. Do not set absent optional Sentry/S3/Uptime values. Set `SMOKE_TG_ID` only if a real Telegram ID is available in the approved credential source.

Read back names and timestamps with:

```bash
gh secret list --repo trafficolog/volleytime --json name,updatedAt
```

Expected: all required names and both VPS names exist; values are never readable or printed.

- [ ] **Step 8: Record external evidence and close Task 9.8.6**

Update only the task card with fingerprints, secret names, verification timestamps and access results; never include secret values.

- [ ] **Step 9: Commit, PR, CI and merge**

Commit only the task card, runbook and test:

```bash
git commit -m "docs(deploy): provision dedicated actions credentials" -m "Task: 9.8.6" -m "Release: v0.1.4"
```

Run the full repository gate, push, create a PR to `main`, attach it, wait for green CI, merge, and update local `main`.

### Task 3: Task 9.8.7 — bundle-based automatic local build

**Files:**

- Create: `docs/tasks/9-8-7-bundle-production-deploy.md`
- Create: `scripts/release-bundle.mjs`
- Modify: `.github/workflows/deploy.yml`
- Modify: `scripts/deploy-local-build.sh`
- Modify: `apps/web/server/utils/deploy-contract.test.ts`
- Modify: `apps/web/server/utils/release-backup-contract.test.ts`
- Modify: `docs/operations/runbooks/deploy.md`

**Interfaces:**

- Consumes: `node scripts/release-bundle.mjs verify|advance --repo PATH --bundle FILE --expected SHA`; dedicated SSH credentials from Task 2.
- Produces: automatic push-to-`prod` bundle path; remote entrypoint `bash .deploy/scripts/deploy-local-build.sh deploy-bundle .deploy/release.bundle FULL_SHA` for Task 4 and live acceptance.

- [ ] **Step 1: Create the SDD card and branch**

From updated `main`, create `chore/9.8.7-bundle-production-deploy`. Specify exact rejection behavior for invalid/mismatched bundles, dirty tracked files and non-fast-forward targets, plus automatic push routing and backup-before-advance ordering.

- [ ] **Step 2: Write failing behavioral bundle tests**

In `deploy-contract.test.ts`, create temporary Git repositories with `git init`, two linear commits and `git bundle create`. Invoke the new CLI through `spawnSync(process.execPath, ...)` and assert:

```ts
expect(valid.status).toBe(0)
expect(mismatched.status).not.toBe(0)
expect(mismatched.stderr).toContain('expected SHA is not advertised by bundle')
expect(invalid.status).not.toBe(0)
expect(dirty.stderr).toContain('tracked checkout is not clean')
expect(nonFastForward.stderr).toContain('target is not a fast-forward')
```

Also assert a valid `advance` leaves branch `prod` at the expected SHA while an untracked `.env` file remains untouched.

- [ ] **Step 3: Write failing workflow and ordering tests**

Replace the old GHCR-default expectations with assertions that:

```ts
expect(workflow).toContain('git bundle create release.bundle HEAD')
expect(workflow).toContain("source: '.env.production,release.bundle")
expect(workflow).toContain('deploy-bundle .deploy/release.bundle ${{ github.sha }}')
expect(workflow).toContain("github.event_name == 'push'")
expect(workflow).toContain("inputs.deployment_mode == 'ghcr'")
expect(script).not.toContain('git fetch origin prod')
expect(script.indexOf('backup-local.sh')).toBeLessThan(script.indexOf('release-bundle.mjs advance'))
```

Add a release-backup contract assertion that backup precedes bundle advancement as well as migration.

- [ ] **Step 4: Run focused tests and observe RED**

```bash
pnpm vitest run apps/web/server/utils/deploy-contract.test.ts apps/web/server/utils/release-backup-contract.test.ts
```

Expected: FAIL because `release-bundle.mjs`, bundle workflow routing and the new remote entrypoint do not exist.

- [ ] **Step 5: Implement `scripts/release-bundle.mjs`**

Implement a small CLI with explicit `verify` and `advance` commands. Use `execFileSync('git', args, { cwd, encoding: 'utf8', stdio: [...] })`, never shell interpolation. `verify` runs `git bundle verify` and parses `git bundle list-heads` to require the exact 40-character SHA. `advance` requires a clean tracked checkout, fetches only the expected commit from the local bundle, verifies `FETCH_HEAD`, checks `git merge-base --is-ancestor HEAD FETCH_HEAD`, checks out `prod`, and executes `git merge --ff-only FETCH_HEAD`.

Allow untracked runtime files by checking `git status --porcelain --untracked-files=no`. Emit only operation names and SHAs; never environment values.

- [ ] **Step 6: Implement the remote bundle entrypoint**

In `deploy-local-build.sh`, add `deploy-bundle BUNDLE EXPECTED_SHA`. Validate argument shape and bundle first, record the current SHA, create the local backup, call `release-bundle.mjs advance`, then build, migrate and start. Use a trap to delete the staged bundle on exit. Remove server-side `git fetch`/`pull` from the automatic path; retain no implicit outbound fallback.

- [ ] **Step 7: Route automatic pushes through the bundle path**

In `deploy.yml`:

- use `actions/checkout@v4` with `fetch-depth: 0`;
- make `build-and-push` run only for manual `deployment_mode=ghcr`;
- create `release.bundle` from `HEAD` for push and manual local-build runs;
- upload the bundle, `release-bundle.mjs`, deploy script and backup script;
- run `deploy-bundle` for every push and for manual local-build;
- keep manual GHCR deploy and rollback conditions explicit and mutually exclusive.

- [ ] **Step 8: Update the runbook**

Make bundle/local-build the active automatic path. State that the VPS requires neither GitHub nor GHCR egress for this path. Keep GHCR as manual-only until reachability is verified.

- [ ] **Step 9: Run focused tests and observe GREEN**

Run the focused Vitest command from Step 4. Expected: all bundle, workflow, backup ordering and existing deploy tests pass.

- [ ] **Step 10: Run shell/static verification**

```bash
bash -n scripts/deploy-local-build.sh
node scripts/release-bundle.mjs --help
git diff --check
```

Expected: shell syntax is valid, CLI usage exits successfully without mutation, diff check is clean.

- [ ] **Step 11: Commit, full gate, PR and merge**

```bash
git commit -m "feat(deploy): deliver production from verified bundle" -m "Task: 9.8.7" -m "Release: v0.1.4"
```

Run all five repository gates, push, create/attach PR, wait for green CI, merge, and update local `main`.

### Task 4: Task 9.9.14 — deterministic release identity and rollback manifest

**Files:**

- Create: `docs/tasks/9-9-14-release-identity.md`
- Modify: `docker-compose.prod.yml`
- Modify: `scripts/deploy-local-build.sh`
- Modify: `.github/workflows/deploy.yml`
- Modify: `scripts/smoke.mjs`
- Modify: `apps/web/server/utils/deploy-contract.test.ts`
- Create: `apps/web/server/utils/release-identity-contract.test.ts`
- Modify: `docs/operations/runbooks/deploy.md`

**Interfaces:**

- Consumes: `EXPECTED_SHA` delivered by Task 3; `.env.images` and `.env.images.previous` release manifests.
- Produces: `RELEASE_VERSION` equal to the full commit SHA in web/bot health responses; SHA-tagged local images; rollback that restores prior manifest and identity.

- [ ] **Step 1: Create the SDD card and branch**

From updated `main`, create `fix/9.9.14-release-identity`. Specify full-SHA health identity, SHA-tagged local images, previous-manifest preservation, same-SHA redeploy behavior and rollback identity.

- [ ] **Step 2: Write the failing release identity tests**

Create `release-identity-contract.test.ts` to read compose, workflow, deploy script and smoke script. Assert:

```ts
expect(compose).toContain('RELEASE_VERSION: ${RELEASE_VERSION:-dev}')
expect(compose).not.toContain('RELEASE_VERSION: ${WEB_IMAGE:-dev}')
expect(localBuild).toContain('RELEASE_VERSION=')
expect(localBuild).toContain('volleytime-web:${expected_sha}')
expect(localBuild).toContain('.env.images.previous')
expect(workflow).toContain('RELEASE_VERSION=${{ github.sha }}')
expect(smoke).toContain('EXPECTED_RELEASE')
```

Add an ordering assertion that `.env.images.previous` is copied before the new manifest is written. Add a same-SHA assertion requiring the script to avoid replacing the previous manifest with an identical current manifest.

- [ ] **Step 3: Run focused tests and observe RED**

```bash
pnpm vitest run apps/web/server/utils/release-identity-contract.test.ts apps/web/server/utils/deploy-contract.test.ts
```

Expected: FAIL on the old image-derived `RELEASE_VERSION` and missing local SHA manifest.

- [ ] **Step 4: Make compose consume explicit release identity**

Change web and bot environment entries to `RELEASE_VERSION: ${RELEASE_VERSION:-dev}`. Do not change health response code; it already returns the environment value.

- [ ] **Step 5: Build and preserve SHA-tagged local images**

Before local build, create a candidate manifest with:

```dotenv
WEB_IMAGE=volleytime-web:FULL_SHA
BOT_IMAGE=volleytime-bot:FULL_SHA
MIGRATOR_IMAGE=volleytime-migrator:FULL_SHA
RELEASE_VERSION=FULL_SHA
```

Use Compose with both `.env` and `.env.images` so `build migrate web bot` creates those tags. Preserve `.env.images.previous` only when the current manifest differs from the candidate. On rollback, restore the previous Git SHA and manifest before rebuilding/starting.

- [ ] **Step 6: Align the GHCR manifest**

Add `RELEASE_VERSION=${{ github.sha }}` to the GHCR `.env.images` generation. Preserve previous manifest before replacement and do not expose it as a secret.

- [ ] **Step 7: Make smoke verify the expected release**

When `EXPECTED_RELEASE` is set, require `healthBody.release === EXPECTED_RELEASE` and report only actual/expected SHAs. Set `EXPECTED_RELEASE: ${{ github.sha }}` in the workflow smoke step.

- [ ] **Step 8: Run focused tests and observe GREEN**

Run the Step 3 command. Expected: all release identity, deploy and same-SHA manifest tests pass.

- [ ] **Step 9: Run full verification and commit**

Run shell syntax, `git diff --check`, and all five repository gates. Commit:

```bash
git commit -m "fix(deploy): report deterministic release identity" -m "Task: 9.9.14" -m "Release: v0.1.4"
```

Push, create/attach PR, wait for green CI, merge, and update local `main`.

### Task 5: Promote the `v0.1.4` release candidate and exercise rollback

**Files:**

- External: GitHub `prod`, Deploy workflow, VPS `/opt/volleytime`, local release backup directory.
- Evidence source for Task 6: workflow URL, deployed SHAs, backup name/hash/restore counts, health outputs and rollback timestamps.

**Interfaces:**

- Consumes: merged Tasks 2-4 on GitHub `main`; automatic bundle path; release manifest.
- Produces: live evidence that the automatic deploy, backup, exact identity, rollback to `v0.1.3`, and redeploy to the candidate all work.

- [ ] **Step 1: Run the pre-promotion repository gate on exact `main`**

In a clean verification worktree at GitHub `main`, run:

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
bash -n scripts/deploy-local-build.sh
```

Expected: every command exits zero. Record test file/test counts and the exact candidate SHA.

- [ ] **Step 2: Verify production preconditions**

Read-only checks must show server branch `prod` at `91f6bff`, clean tracked files, healthy web/bot/PostgreSQL, running Caddy, mode-0600 `.env`, and working normal/recovery/CI SSH keys. Confirm required GitHub Secret names exist.

- [ ] **Step 3: Promote `main` to `prod` by fast-forward only**

Verify `origin/prod` is an ancestor of the candidate. Update `prod` to the exact candidate SHA without force. The push must trigger the Deploy workflow.

- [ ] **Step 4: Wait for automatic workflow completion**

Track the run until completion. On failure, inspect the failing job and use systematic debugging; do not manually bypass the failed gate. Expected success includes source gate, tests, bundle upload, backup, local build, migrate, up and smoke with exact release SHA.

- [ ] **Step 5: Verify the deployed candidate live**

Check server `prod` and HEAD, container health, IPv6 network, external HTTPS, `/api/health.release`, bot `/healthz.release`, webhook registration and Telegram `getMe` through `2001:67c:4e8:f004::9`. Expected: every reported release equals the candidate full SHA.

- [ ] **Step 6: Validate the new pre-migration backup**

Require a new timestamped mode-0600 gzip created by this workflow. Restore it into a uniquely named temporary PostgreSQL 16 container, verify at least ten public tables and all critical tables, print only non-sensitive counts, then remove the temporary container.

- [ ] **Step 7: Perform the controlled application rollback**

Run the documented local-build rollback to `91f6bff`. Do not reverse migrations and do not restore the production database. Verify web/bot/PostgreSQL health, Caddy, external HTTPS and release identity `91f6bffbd005876f94ffd1c31cebb4bcd891a752`.

- [ ] **Step 8: Redeploy the same candidate through GitHub Actions**

Use manual workflow dispatch on ref `prod` with `deployment_mode=local-build`. Expected: the bundle path safely fast-forwards from the rollback revision, the same candidate identity returns, smoke passes, and previous-manifest handling remains valid.

- [ ] **Step 9: Collect evidence without secrets**

Record workflow URLs, public SHAs, container states, backup filename/permissions/size, restore table count, domain health and Telegram username. Do not capture `.env`, tokens, private keys or webhook secret paths.

### Task 6: Task 9.11.4 — reconcile evidence and publish `v0.1.4`

**Files:**

- Create: `docs/tasks/9-11-4-production-release-evidence.md`
- Create: `docs/operations/releases/v0.1.4.md`
- Modify: `docs/operations/status/current-state.md`
- Modify: `docs/RELEASES.md`
- Modify: `CHANGELOG.md`
- Modify: `docs/operations/runbooks/deploy.md`
- Modify: evidence-backed task cards listed below.

**Interfaces:**

- Consumes: Task 5 live evidence and merged code candidate SHA.
- Produces: honest repository status, final documentation commit, final production SHA and immutable GitHub Release `v0.1.4`.

- [ ] **Step 1: Create the SDD card and evidence branch**

From updated `main`, create `docs/9.11.4-production-release-evidence`. The card requires exact tested-candidate links/SHAs, no secret values, explicit open gates, and release documentation that is ready for final promotion. Tag creation remains a post-merge release operation because the merge SHA does not exist while the branch is being written.

- [ ] **Step 2: Update only evidence-backed task statuses**

Set `done` with dated evidence for cards whose entire acceptance was exercised:

```text
9.1.1, 9.1.2, 9.2.2, 9.3.2, 9.3.4,
9.7.3, 9.8.1, 9.8.2, 9.8.3, 9.8.5,
9.8.6, 9.8.7, 9.9.13, 9.9.14, 9.11.3, 9.11.4
```

Before changing each card, re-read every acceptance criterion. If any criterion lacks evidence, keep that card `in_progress` and state the exact missing item instead of following the expected list blindly.

- [ ] **Step 3: Preserve all unsupported external gates**

Keep `8.7.2`, `8.8.11`, `9.4.1`, `9.5.2`, `9.6.1`, `9.6.2`, `9.7.1`, and the S3-specific parts of `9.7.2` open. Keep `9.3.1` or `9.5.1` open unless their complete live criteria were independently verified during execution.

- [ ] **Step 4: Update release and operational documents**

Record `v0.1.3` as the verified manual baseline and `v0.1.4` as automatic production deployment. Make local bundle build the active path and GHCR manual-only. Update the current open-card count from the actual frontmatter rather than copying a predicted number.

- [ ] **Step 5: Add exact `v0.1.4` release notes**

In `docs/operations/releases/v0.1.4.md`, include the code/evidence scope, tested candidate SHA, workflow URL, rollback/redeploy result, backup restore result and explicit exclusions. State that the immutable `v0.1.4` tag is the authority for the final docs-inclusive release SHA. Do not claim full MVP acceptance or the one-week gate.

- [ ] **Step 6: Verify documentation consistency**

Run:

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
git diff --check
```

Additionally search for stale statements that GitHub Secrets are empty, first VPS deploy is pending, GHCR is the active default, health release is `dev`, or production containers are unverified. Expected: no contradictory current-state claim remains; historical reports stay unchanged.

- [ ] **Step 7: Commit, PR, CI and merge**

```bash
git commit -m "docs(release): record production automation evidence" -m "Task: 9.11.4" -m "Release: v0.1.4"
```

Push, create/attach PR, wait for green CI, merge, and update local `main`.

- [ ] **Step 8: Promote the final docs commit and verify final production SHA**

Fast-forward `prod` to the final `main` commit. Wait for the automatic bundle deployment and smoke. Verify GitHub `main`, GitHub `prod`, server `prod`, `/api/health.release`, and bot `/healthz.release` all equal the final full SHA.

- [ ] **Step 9: Create immutable `v0.1.4` release**

Confirm tag and GitHub Release do not already exist. After the final production SHA is known, create an ignored release-notes file inside this plan's `.superpowers/sdd/` workspace by copying `docs/operations/releases/v0.1.4.md` and appending the exact final production SHA and final workflow URL. Use `apply_patch` for that file so the secret-safe release text is inspectable before publication.

Create an annotated tag on the exact final production SHA, push only that tag, and create the GitHub Release with the ignored exact-SHA notes file. Read back the tag target, release URL and published body. Expected: the tag, GitHub Release, GitHub `main`, GitHub `prod`, server HEAD and both health endpoints resolve to the same full SHA.

- [ ] **Step 10: Final audit**

Verify production remains healthy, the latest release backup is valid, required GitHub Secrets still exist by name, temporary bundles/restore containers are removed, no secret was committed, and the main checkout retains only pre-existing unrelated untracked files.
