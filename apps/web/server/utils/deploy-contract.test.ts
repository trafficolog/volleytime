import { spawnSync } from 'node:child_process'
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

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
const releaseBundlePath = fileURLToPath(
  new URL('../../../../scripts/release-bundle.sh', import.meta.url),
)
const bashExecutable =
  process.platform === 'win32' ? 'C:\\Program Files\\Git\\bin\\bash.exe' : 'bash'
const releaseBundleScript =
  process.platform === 'win32'
    ? releaseBundlePath.replace(/^([A-Za-z]):\\/, '/$1/').replaceAll('\\', '/')
    : releaseBundlePath
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

function runGit(cwd: string, ...args: string[]): string {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8' })
  expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0)
  return result.stdout.trim()
}

function createBundleFixture() {
  const root = mkdtempSync(join(tmpdir(), 'volleytime-release-bundle-'))
  dirs.push(root)
  const source = join(root, 'source')
  const deployed = join(root, 'deployed')
  const bundle = join(root, 'release.bundle')
  mkdirSync(source)
  runGit(source, 'init', '-b', 'prod')
  runGit(source, 'config', 'user.name', 'Volley Time Test')
  runGit(source, 'config', 'user.email', 'test@volleytime.invalid')
  writeFileSync(join(source, 'release.txt'), 'baseline\n')
  runGit(source, 'add', 'release.txt')
  runGit(source, 'commit', '-m', 'baseline')
  const baseline = runGit(source, 'rev-parse', 'HEAD')
  runGit(root, 'clone', source, deployed)
  writeFileSync(join(source, 'release.txt'), 'candidate\n')
  runGit(source, 'add', 'release.txt')
  runGit(source, 'commit', '-m', 'candidate')
  const candidate = runGit(source, 'rev-parse', 'HEAD')
  runGit(source, 'checkout', '--detach', candidate)
  runGit(source, 'bundle', 'create', bundle, 'HEAD')
  return { root, source, deployed, bundle, baseline, candidate }
}

function runBundleCli(
  command: 'verify' | 'advance',
  fixture: ReturnType<typeof createBundleFixture>,
  expected = fixture.candidate,
) {
  return spawnSync(
    bashExecutable,
    [
      releaseBundleScript,
      command,
      '--repo',
      fixture.deployed,
      '--bundle',
      fixture.bundle,
      '--expected',
      expected,
    ],
    { encoding: 'utf8' },
  )
}

describe('release bundle CLI', () => {
  it('verifies and advances the exact fast-forward commit without touching untracked runtime files', () => {
    const fixture = createBundleFixture()
    writeFileSync(join(fixture.deployed, '.env'), 'runtime-only\n')

    const valid = runBundleCli('verify', fixture)
    expect(valid.status, valid.stderr).toBe(0)
    const advanced = runBundleCli('advance', fixture)
    expect(advanced.status, advanced.stderr).toBe(0)
    expect(runGit(fixture.deployed, 'rev-parse', 'HEAD')).toBe(fixture.candidate)
    expect(existsSync(join(fixture.deployed, '.env'))).toBe(true)
  })

  it('rejects a valid bundle that does not advertise the expected SHA', () => {
    const fixture = createBundleFixture()
    const mismatched = runBundleCli('verify', fixture, fixture.baseline)

    expect(mismatched.status).not.toBe(0)
    expect(mismatched.stderr).toContain('expected SHA is not advertised by bundle')
  })

  it('rejects an invalid bundle', () => {
    const fixture = createBundleFixture()
    writeFileSync(fixture.bundle, 'not a git bundle')
    const invalid = runBundleCli('verify', fixture)

    expect(invalid.status).not.toBe(0)
    expect(runGit(fixture.deployed, 'rev-parse', 'HEAD')).toBe(fixture.baseline)
  })

  it('rejects a dirty tracked checkout', () => {
    const fixture = createBundleFixture()
    writeFileSync(join(fixture.deployed, 'release.txt'), 'dirty\n')
    const dirty = runBundleCli('advance', fixture)

    expect(dirty.status).not.toBe(0)
    expect(dirty.stderr).toContain('tracked checkout is not clean')
    expect(runGit(fixture.deployed, 'rev-parse', 'HEAD')).toBe(fixture.baseline)
  })

  it('rejects advancing a production checkout that is not on prod', () => {
    const fixture = createBundleFixture()
    runGit(fixture.deployed, 'switch', '-c', 'main')
    const rejected = runBundleCli('advance', fixture)

    expect(rejected.status).not.toBe(0)
    expect(rejected.stderr).toContain('production checkout must be on prod')
    expect(runGit(fixture.deployed, 'rev-parse', 'HEAD')).toBe(fixture.baseline)
  })

  it('rejects a non-fast-forward target', () => {
    const fixture = createBundleFixture()
    runGit(fixture.deployed, 'config', 'user.name', 'Volley Time Test')
    runGit(fixture.deployed, 'config', 'user.email', 'test@volleytime.invalid')
    writeFileSync(join(fixture.deployed, 'deployed-only.txt'), 'diverged\n')
    runGit(fixture.deployed, 'add', 'deployed-only.txt')
    runGit(fixture.deployed, 'commit', '-m', 'diverged production')
    const deployedSha = runGit(fixture.deployed, 'rev-parse', 'HEAD')
    const rejected = runBundleCli('advance', fixture)

    expect(rejected.status).not.toBe(0)
    expect(rejected.stderr).toContain('target is not a fast-forward')
    expect(runGit(fixture.deployed, 'rev-parse', 'HEAD')).toBe(deployedSha)
  })
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
    expect(workflow).toContain('git bundle create release.bundle HEAD')
    expect(workflow).toContain("source: '.env.production,release.bundle")
    expect(workflow).toContain('deploy-bundle .deploy/release.bundle ${{ github.sha }}')
    expect(script).not.toContain('git fetch origin prod')
    expect(script).not.toContain('git pull --ff-only')
    expect(script).toContain('bash .deploy/scripts/release-bundle.sh verify')
    expect(script).not.toContain('node .deploy/scripts/release-bundle')
    expect(runbook).toContain('task branch → main → prod')
    expect(runbook).toContain('Do not develop directly in `prod`')
  })

  it('uses local bundle builds automatically while keeping GHCR as a manual alternative', () => {
    const workflow = readFileSync(workflowPath, 'utf8')

    expect(workflow).toContain('deployment_mode:')
    expect(workflow).toContain('- ghcr')
    expect(workflow).toContain('- local-build')
    expect(workflow).toContain("github.event_name == 'push'")
    expect(workflow).toContain("inputs.deployment_mode == 'ghcr'")
    expect(workflow).toContain("inputs.deployment_mode == 'local-build'")
    expect(workflow).toContain('Deploy verified bundle over SSH')
    expect(workflow).toContain('scripts/deploy-local-build.sh deploy-bundle')
  })

  it('gives long-running local-build deploy and rollback bounded SSH timeouts', () => {
    const workflow = readFileSync(workflowPath, 'utf8')
    const deployStep = workflow.match(
      /- name: Deploy verified bundle over SSH[\s\S]*?(?=\n {6}- name:)/,
    )?.[0]
    const rollbackStep = workflow.match(
      /- name: Rollback local build on failed smoke[\s\S]*?(?=\n {6}- name:|\n {2}[a-z-]+:|$)/,
    )?.[0]

    expect(deployStep).toContain('command_timeout: 30m')
    expect(rollbackStep).toContain('command_timeout: 30m')
  })

  it('local-build deploy records the previous revision and migrates before starting services', () => {
    const script = readFileSync(localBuildScriptPath, 'utf8')
    const previous = script.indexOf('git rev-parse HEAD')
    const advance = script.indexOf('release-bundle.sh advance')
    const build = script.indexOf('build migrate web bot')
    const migrate = script.indexOf('run --rm migrate')
    const up = script.indexOf('up -d')

    expect(script).toContain('.deploy/previous-git-sha')
    expect(previous).toBeGreaterThan(-1)
    expect(advance).toBeGreaterThan(previous)
    expect(build).toBeGreaterThan(advance)
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
