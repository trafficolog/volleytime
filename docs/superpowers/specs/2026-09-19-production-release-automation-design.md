# Production release automation design (`v0.1.3` -> `v0.1.4`)

**Task:** 9.11.3

**Approved direction:** 2026-09-19

**Repository:** `trafficolog/volleytime`

## Intent and success criteria

The goal is to preserve the already verified production state as an immutable `v0.1.3` baseline, then ship a narrowly scoped `v0.1.4` patch that makes promotion from GitHub `main` to `prod` reproducible and automatically deployable.

Success means:

- GitHub `main` remains the development integration branch and `prod` remains the only production source;
- every change is implemented through its own SDD task, branch, tests and PR;
- a push to `prod` passes repository gates and deploys without the VPS contacting GitHub or GHCR;
- production creates a local database dump before migrations, can roll back the application revision, and reports the deployed commit instead of `dev`;
- a dedicated CI key can be revoked without affecting the user's normal or recovery access;
- live evidence updates only the task cards whose complete acceptance criteria were exercised.

## Current constraints

- The verified baseline is `91f6bffbd005876f94ffd1c31cebb4bcd891a752` on local/GitHub `main`, GitHub `prod`, and the VPS `prod` checkout.
- The VPS cannot currently resolve `ghcr.io`; direct server-to-GitHub fetches have also been unreliable.
- GitHub Actions Secrets are empty.
- The current administrative and recovery SSH keys must not be reused by CI.
- Sentry DSNs, UptimeRobot/healthcheck URL, S3 credentials and backup encryption recipient are not configured.
- The pilot uses local release backups plus provider-level server backups; S3 remains deferred.

## Release sequence

### `v0.1.3` — verified production baseline

Create an annotated tag and GitHub Release pointing exactly to `91f6bff`. The release notes record the already verified HTTPS, database, bot, concrete-IP Telegram IPv6 check, container health and isolated backup restore. The tag is never moved after publication.

This release does not claim automatic deployment, Sentry/UptimeRobot, S3 backup, full Telegram UI QA or the one-week MVP acceptance gate.

### `v0.1.4` — production automation patch

Implement and merge the following tasks in order:

1. **9.8.6 — dedicated GitHub Actions production credentials.** Generate a new Ed25519 key, add only its public key to `deploy`, upload its private key and the required production values to GitHub Secrets, and verify that existing user and recovery keys still work.
2. **9.8.7 — outbound-independent bundle deploy.** Package the exact `prod` commit in GitHub Actions, upload it with the deploy scripts, validate it on the VPS, fast-forward the server `prod` branch from the local bundle, then run backup -> build -> migrate -> up -> smoke. Keep GHCR as an explicitly selected manual alternative.
3. **9.9.14 — deterministic release identity.** Tag locally built web, bot and migrator images with the commit SHA and pass an explicit `RELEASE_VERSION`; `/api/health` and bot `/healthz` must identify the deployed commit. Rollback restores the previous identity.
4. **9.11.4 — production evidence reconciliation.** Update task cards, current-state, release plan, changelog and runbook from live evidence; leave every untested external gate open.

After all PRs pass and merge into `main`, fast-forward `prod` to the selected `main` commit. The resulting push must execute the new automatic path. After smoke and rollback/redeploy acceptance, create immutable tag and GitHub Release `v0.1.4` on that exact commit.

## Deployment architecture

GitHub Actions is the source-side orchestrator. It checks out `prod`, runs the full repository gate and creates a complete Git bundle containing the exact workflow SHA. The bundle, production environment file and versioned deploy scripts are uploaded to `/opt/volleytime/.deploy` through the dedicated CI key.

The remote deploy validates all of the following before changing the checkout:

- workflow ref is `refs/heads/prod`;
- bundle is structurally valid;
- bundled target SHA equals the expected GitHub SHA;
- the current server revision is an ancestor of the target (fast-forward only);
- tracked server files are clean; known runtime paths remain untracked.

The server then creates and validates a local PostgreSQL dump, advances `prod` from the local bundle, builds SHA-tagged images, runs migrations as a separate stage, starts the stack, and prunes unused layers only after startup. This path does not perform `git fetch`, `git pull`, GHCR login or GHCR pull from the VPS.

The existing GHCR flow remains available only through an explicit manual-dispatch choice. It is not the automatic path until live reachability is restored and verified.

## Secrets and SSH model

Create a dedicated Ed25519 key pair named for GitHub Actions. Store the private key only in GitHub Secret `VPS_SSH_KEY`; add the public key to `/home/deploy/.ssh/authorized_keys` with OpenSSH `restrict` options. Existing user and recovery keys remain unchanged and are re-tested after installation.

Populate the workflow's required GitHub Secrets from the current production configuration without printing values. Optional unset integrations remain empty and are not falsely marked configured. `VPS_HOST` is set independently. Commands and logs may show secret names and validation results, never values.

The workflow writes `.env.production` with mode `0600`, uploads it into mode `0700` staging, installs `/opt/volleytime/.env` as `0600`, and deletes the staged copy. No secret becomes part of the bundle, image, artifact or release notes.

## Release identity and rollback

`.env.images` becomes the non-secret release manifest for both deploy paths. It contains SHA-tagged image names and a `RELEASE_VERSION` equal to the full 40-character commit SHA. Compose reads `.env` and `.env.images`; application health responses derive release identity from the explicit release value rather than an image-name fallback.

Before replacement, the deploy stores both the previous Git SHA and previous image manifest. A failed smoke invokes the matching rollback path. For local builds, rollback restores the previous Git revision and previous release manifest, rebuilds only the application services if the previous images are unavailable, starts them, and verifies health. Database migrations remain forward-only and must stay compatible with the immediately preceding application release.

Live rollback acceptance for `v0.1.4` is controlled: deploy `v0.1.4`, roll back to `v0.1.3`, verify HTTPS/health, then redeploy `v0.1.4` and verify again. No production data is restored or destroyed during this test.

## Tests and acceptance

Each implementation task follows red -> green -> refactor. Repository tests must cover:

- push and manual event routing between bundle/local-build and GHCR paths;
- rejection of non-`prod` refs, mismatched SHAs, invalid bundles, dirty tracked checkouts and non-fast-forward targets;
- backup occurring before checkout advancement or migrations;
- absence of server-side GitHub/GHCR access in the automatic path;
- SHA-tagged local images and `RELEASE_VERSION` propagation;
- rollback restoring the previous revision and release identity;
- no secret values in emitted workflow/script output.

Before each PR, run `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test` and `pnpm build`, plus focused shell/workflow contract tests. GitHub CI must pass before merge.

Live acceptance requires:

1. required GitHub Secrets exist by name and the dedicated key authenticates;
2. current user and recovery keys still authenticate;
3. a `prod` push completes the automatic workflow;
4. the pre-migration dump passes gzip validation and isolated restore;
5. PostgreSQL, web and bot are healthy and Caddy is running;
6. external `/api/health` is HTTP 200 and reports the exact release SHA;
7. Telegram `getMe` succeeds through the concrete IPv6 address;
8. controlled rollback to `v0.1.3` and redeploy to `v0.1.4` both pass smoke.

## Evidence and status policy

Close only cards whose full acceptance criteria are supported by repository and live evidence. The expected closable production cards include the image runtime, live Caddy/HTTPS, deploy user, IPv6 Telegram egress, local release backup, automatic deploy/secrets, `prod`-branch promotion and container healthcheck tasks.

Keep these gates open unless additional evidence appears during execution:

- Telegram Mini App manual QA on real client platforms;
- BotFather menu/deep-link acceptance not covered by API registration;
- real internal notification delivery not exercised by smoke;
- Sentry event delivery and UptimeRobot alerting;
- S3 upload/retention and S3-based restore;
- the one-week real-training MVP gate.

## Out of scope

- Phase 10+, automation Phase 15, monetization and other future releases;
- repairing provider DNS/egress for GHCR;
- introducing a private registry or self-hosted Actions runner;
- S3 or observability account provisioning without credentials;
- destructive production database restore.
