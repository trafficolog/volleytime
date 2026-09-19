# Production deploy runbook

This runbook covers the two R0 deployment paths from Task 9.8.3. **GHCR remains the default path.** The local-build path is an explicit fallback for a VPS that cannot reliably pull GitHub Container Registry images.

## Before the first production deploy

Configure the GitHub Secrets required by `.github/workflows/deploy.yml`, provision the VPS from Tasks 9.3.x, point DNS to it, and configure the Telegram Mini App/webhook. The deploy workflow deliberately fails closed when required secrets are missing.

On the VPS, verify GHCR reachability before choosing the active path:

```bash
docker pull ghcr.io/trafficolog/volleytime/web:latest
```

If the pull succeeds reliably, keep `deployment_mode=ghcr`. If it times out or the registry is unreachable from the VPS network, use the manual `local-build` fallback.

## Branch promotion contract

The release path is `task branch → main → prod`: task branches are reviewed and merged into `main`, then a tested `main` revision is promoted to `prod` for production deployment. Do not develop directly in `prod`, and do not use a task branch as a production source.

The `prod` update must be a reviewed fast-forward from the selected `main` revision. A push to `main` runs the normal CI workflow but does not deploy production. A push to `prod` starts the production workflow; `workflow_dispatch` remains available for an intentional rerun or the local-build fallback.

## Path A — GHCR (default)

A push to `prod` uses this path automatically:

1. tests/lint/typecheck;
2. build and push `web`, `migrator`, and `bot` images tagged with the commit SHA;
3. materialize production secrets into a mode-0600 `.env` on the VPS;
4. pull the SHA-tagged images;
5. run migrations as a separate stage;
6. start the production compose stack;
7. run the smoke check;
8. on smoke failure, restore `.env.images.previous`.

For a manual deploy, run the **Deploy** workflow with `deployment_mode=ghcr`.

## Path B — build on VPS

Use this only when GHCR cannot be pulled from the VPS.

Run the **Deploy** workflow manually and select `deployment_mode=local-build`. CI tests still run, but the registry build/push job is skipped. The workflow uploads the production env and the current fallback script, then executes:

```bash
bash .deploy/scripts/deploy-local-build.sh deploy
```

The script:

1. records the current Git revision in `.deploy/previous-git-sha`;
2. fast-forwards the VPS checkout from `origin/prod`;
3. builds `migrate web bot` locally through `docker-compose.prod.yml`;
4. runs the migration stage;
5. starts the stack and prunes unused images.

The VPS therefore needs Git access to the canonical repository in addition to Docker/Compose.

## Rollback

### GHCR path

The workflow records the previous image set before replacing `.env.images`. If smoke fails it restores `.env.images.previous` and starts the previous SHA-tagged images.

For a manual GHCR rollback, verify the target SHA and restore the corresponding image variables before `docker compose ... up -d`.

### local-build path

The local-build deploy records the previous Git SHA before pulling `prod`. To return to it:

```bash
cd /opt/volleytime
bash .deploy/scripts/deploy-local-build.sh rollback
```

Rollback performs `git reset --hard` to the recorded revision, rebuilds web/bot, and restarts them.

**Database migrations are not automatically reversed.** R0 production migrations must be forward-compatible with the previous application revision. A destructive migration requires a separately reviewed database rollback plan and a tested backup restore; do not improvise it during an incident.

## Production verification checklist

After the first live deployment verify:

- `https://<DOMAIN>/api/health` returns 200 and reports the database healthy;
- the Telegram bot answers through webhook mode;
- the Mini App opens through HTTPS and authenticates with real initData;
- an organizer can create an event and a second Telegram account can book it;
- backup upload reaches the configured S3 bucket;
- restore-test succeeds against a recent backup;
- Sentry receives a controlled web and bot test error;
- UptimeRobot/other external health monitoring is active;
- rollback is exercised once and the service returns healthy afterwards.

Record whether GHCR or `local-build` is the active production path only after this VPS verification.
