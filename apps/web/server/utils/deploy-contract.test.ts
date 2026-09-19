import { mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

import { afterEach, describe, expect, it } from 'vitest'

const workflowPath = fileURLToPath(
  new URL('../../../../.github/workflows/deploy.yml', import.meta.url),
)
const rendererPath = fileURLToPath(
  new URL('../../../../scripts/render-production-env.mjs', import.meta.url),
)
const localBuildScriptPath = fileURLToPath(
  new URL('../../../../scripts/deploy-local-build.sh', import.meta.url),
)
const productionSourceGuardPath = fileURLToPath(
  new URL('../../../../scripts/require-prod-ref.mjs', import.meta.url),
)
const deployRunbookPath = fileURLToPath(
  new URL('../../../../docs/operations/runbooks/deploy.md', import.meta.url),
)

const requiredEnv = {
  DOMAIN: 'volleytime.example',
  DB_PASSWORD: 'db "secret" with spaces',
  TELEGRAM_BOT_TOKEN: '123456:secret-token',
  TELEGRAM_BOT_USERNAME: 'volleytime_bot',
  WEBHOOK_SECRET_PATH: 'secret/path',
  WEBHOOK_SECRET_TOKEN: 'webhook secret',
  BETTER_AUTH_SECRET: 'better-auth-secret-at-least-32-chars',
  BETTER_AUTH_URL: 'https://volleytime.example',
  BOT_INTERNAL_SECRET: 'internal secret',
  WEB_URL: 'https://volleytime.example',
}

const dirs: string[] = []
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true })
})

describe('fallback deployment contract', () => {
  it('rejects production deployment from every ref except prod', () => {
    const runGuard = (ref: string) =>
      spawnSync(process.execPath, [productionSourceGuardPath], {
        env: { ...process.env, GITHUB_REF: ref },
        encoding: 'utf8',
      })

    const prod = runGuard('refs/heads/prod')
    expect(prod.status, prod.stderr).toBe(0)

    for (const ref of ['refs/heads/main', 'refs/heads/fix/example', 'refs/tags/v0.1.0']) {
      const rejected = runGuard(ref)
      expect(rejected.status).not.toBe(0)
      expect(rejected.stderr).toContain('requires refs/heads/prod')
    }

    const workflow = readFileSync(workflowPath, 'utf8')
    expect(workflow).toContain('source-gate:')
    expect(workflow).toContain('node scripts/require-prod-ref.mjs')
    expect(workflow).toMatch(/test:\n\s+name: Test before deploy\n\s+needs: source-gate/)
  })

  it('deploys production only from prod and keeps main as the integration branch', () => {
    const workflow = readFileSync(workflowPath, 'utf8')
    const script = readFileSync(localBuildScriptPath, 'utf8')
    const runbook = readFileSync(deployRunbookPath, 'utf8')

    expect(workflow).toContain('branches: [prod]')
    expect(workflow).not.toContain('branches: [main]')
    expect(script).toContain('git fetch origin prod')
    expect(script).toContain('git checkout prod')
    expect(script).toContain('git pull --ff-only origin prod')
    expect(script).not.toContain('git pull --ff-only origin main')
    expect(runbook).toContain('task branch → main → prod')
    expect(runbook).toContain('Do not develop directly in `prod`')
  })

  it('offers a manual local-build fallback while keeping GHCR as the default path', () => {
    const workflow = readFileSync(workflowPath, 'utf8')

    expect(workflow).toContain('deployment_mode:')
    expect(workflow).toContain('- ghcr')
    expect(workflow).toContain('- local-build')
    expect(workflow).toContain("inputs.deployment_mode == 'local-build'")
    expect(workflow).toContain('Deploy local build over SSH')
    expect(workflow).toContain('scripts/deploy-local-build.sh deploy')
  })

  it('local-build deploy records the previous revision and migrates before starting services', () => {
    const script = readFileSync(localBuildScriptPath, 'utf8')
    const previous = script.indexOf('git rev-parse HEAD')
    const pull = script.indexOf('git pull --ff-only')
    const build = script.indexOf('build migrate web bot')
    const migrate = script.indexOf('run --rm migrate')
    const up = script.indexOf('up -d')

    expect(script).toContain('.deploy/previous-git-sha')
    expect(previous).toBeGreaterThan(-1)
    expect(pull).toBeGreaterThan(previous)
    expect(build).toBeGreaterThan(pull)
    expect(migrate).toBeGreaterThan(build)
    expect(up).toBeGreaterThan(migrate)
    expect(script).toContain('rollback)')
    expect(script).toContain('git reset --hard')
  })

  it('documents GHCR probing, both deployment paths and rollback limits', () => {
    const runbook = readFileSync(deployRunbookPath, 'utf8')

    expect(runbook).toContain('docker pull ghcr.io/')
    expect(runbook).toContain('deployment_mode')
    expect(runbook).toContain('local-build')
    expect(runbook).toContain('rollback')
    expect(runbook).toContain('forward-compatible')
  })

  it('documents a dedicated restricted GitHub Actions key lifecycle', () => {
    const runbook = readFileSync(deployRunbookPath, 'utf8')

    expect(runbook).toContain('volleytime-github-actions')
    expect(runbook).toContain('restrict')
    expect(runbook).toContain('VPS_SSH_KEY')
    expect(runbook).toContain('volleytime-recovery')
    expect(runbook).toContain('revoke')
  })
})

describe('production env deployment contract', () => {
  it('renders a mode-0600 dotenv file without printing secret values', () => {
    const dir = mkdtempSync(join(tmpdir(), 'volleytime-prod-env-'))
    dirs.push(dir)
    const output = join(dir, '.env.production')
    const renderer = readFileSync(rendererPath, 'utf8')

    const result = spawnSync(process.execPath, [rendererPath, output], {
      env: { ...process.env, ...requiredEnv },
      encoding: 'utf8',
    })

    expect(result.status, result.stderr).toBe(0)
    const rendered = readFileSync(output, 'utf8')
    expect(rendered).toContain('DOMAIN="volleytime.example"')
    expect(rendered).toContain('DB_PASSWORD="db \\"secret\\" with spaces"')
    expect(rendered).toContain('TRUSTED_PROXY="1"')
    expect(renderer).toContain('mode: 0o600')
    expect(renderer).toContain('chmodSync(output, 0o600)')
    if (process.platform !== 'win32') {
      expect(statSync(output).mode & 0o777).toBe(0o600)
    }

    for (const value of Object.values(requiredEnv)) {
      expect(result.stdout).not.toContain(value)
      expect(result.stderr).not.toContain(value)
    }
  })

  it('fails before writing when a required production value is missing', () => {
    const dir = mkdtempSync(join(tmpdir(), 'volleytime-prod-env-'))
    dirs.push(dir)
    const output = join(dir, '.env.production')
    const env = { ...process.env, ...requiredEnv }
    delete env.DB_PASSWORD

    const result = spawnSync(process.execPath, [rendererPath, output], {
      env,
      encoding: 'utf8',
    })

    expect(result.status).not.toBe(0)
    expect(result.stderr).toContain('DB_PASSWORD')
    expect(result.stderr).not.toContain(requiredEnv.BOT_INTERNAL_SECRET)
  })

  it('installs secrets before pull, migrate and up in the deploy workflow', () => {
    const workflow = readFileSync(workflowPath, 'utf8')
    const prepare = workflow.indexOf('Prepare production env')
    const upload = workflow.indexOf('appleboy/scp-action@v1')
    const install = workflow.indexOf('install -m 600')
    const pull = workflow.indexOf('docker compose -f docker-compose.prod.yml')
    const migrate = workflow.indexOf('run --rm migrate')
    const up = workflow.indexOf('up -d')

    expect(prepare).toBeGreaterThan(-1)
    expect(upload).toBeGreaterThan(prepare)
    expect(install).toBeGreaterThan(upload)
    expect(pull).toBeGreaterThan(install)
    expect(migrate).toBeGreaterThan(pull)
    expect(up).toBeGreaterThan(migrate)
  })
})
