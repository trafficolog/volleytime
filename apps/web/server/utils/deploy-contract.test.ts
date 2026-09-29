import { spawnSync } from 'node:child_process'
import {
  chmodSync,
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
const telegramIdentityVerifierPath = fileURLToPath(
  new URL('../../../../scripts/verify-telegram-bot-identity.mjs', import.meta.url),
)
const productionComposePath = fileURLToPath(
  new URL('../../../../docker-compose.prod.yml', import.meta.url),
)
const botEntryPath = fileURLToPath(new URL('../../../bot/src/index.ts', import.meta.url))
const localBuildScriptPath = fileURLToPath(
  new URL('../../../../scripts/deploy-local-build.sh', import.meta.url),
)
const productionSourceGuardPath = fileURLToPath(
  new URL('../../../../scripts/require-prod-ref.mjs', import.meta.url),
)
const releaseBundlePath = fileURLToPath(
  new URL('../../../../scripts/release-bundle.sh', import.meta.url),
)
const ghcrGuardPath = fileURLToPath(
  new URL('../../../../scripts/verify-ghcr-deploy-state.sh', import.meta.url),
)
const bashExecutable =
  process.platform === 'win32' ? 'C:\\Program Files\\Git\\bin\\bash.exe' : 'bash'
const releaseBundleScript =
  process.platform === 'win32'
    ? releaseBundlePath.replace(/^([A-Za-z]):\\/, '/$1/').replaceAll('\\', '/')
    : releaseBundlePath
const ghcrGuardScript =
  process.platform === 'win32'
    ? ghcrGuardPath.replace(/^([A-Za-z]):\\/, '/$1/').replaceAll('\\', '/')
    : ghcrGuardPath
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
    expect(workflow).toContain('git bundle create "$stage/release.bundle" HEAD')
    expect(workflow).toContain(
      'bash .deploy/incoming/${{ github.sha }}/scripts/deploy-image-bundle.sh deploy',
    )
    expect(script).not.toContain('git fetch origin prod')
    expect(script).not.toContain('git pull --ff-only')
    expect(script).toContain('bash .deploy/scripts/release-bundle.sh verify')
    expect(script).not.toContain('node .deploy/scripts/release-bundle')
    expect(runbook).toContain('task branch → main → prod')
    expect(runbook).toContain('Do not develop directly in `prod`')
  })

  it('uses image bundles automatically while keeping GHCR as a manual alternative', () => {
    const workflow = readFileSync(workflowPath, 'utf8')

    expect(workflow).toContain('deployment_mode:')
    expect(workflow).toContain('- ghcr')
    expect(workflow).toContain('- image-bundle')
    expect(workflow).not.toContain('- local-build')
    expect(workflow).toContain("github.event_name == 'push'")
    expect(workflow).toContain("inputs.deployment_mode == 'ghcr'")
    expect(workflow).toContain("inputs.deployment_mode == 'image-bundle'")
    expect(workflow).toContain('Activate image bundle over SSH')
    expect(workflow).not.toContain('scripts/deploy-local-build.sh deploy-bundle')
  })

  it('bounds image transfer, activation, confirmation and rollback', () => {
    const workflow = readFileSync(workflowPath, 'utf8')
    for (const name of [
      'Upload image bundle',
      'Activate image bundle over SSH',
      'Confirm synthetic smoke over SSH',
      'Rollback image bundle after controlled smoke failure',
    ]) {
      const step = workflow.match(new RegExp(`- name: ${name}[\\s\\S]*?(?=\\n {6}- name:|$)`))?.[0]
      expect(step, name).toMatch(/timeout:|command_timeout:/)
    }
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
  it('verifies the Telegram bot identity before rendering production secrets', () => {
    const workflow = readFileSync(workflowPath, 'utf8')
    const verify = workflow.indexOf('node scripts/verify-telegram-bot-identity.mjs')
    const render = workflow.indexOf('node scripts/render-production-env.mjs')

    expect(existsSync(telegramIdentityVerifierPath)).toBe(true)
    expect(verify).toBeGreaterThan(-1)
    expect(render).toBeGreaterThan(verify)
  })

  it('renders a reversible polling fallback for production Telegram updates', () => {
    const dir = mkdtempSync(join(tmpdir(), 'volleytime-prod-mode-'))
    dirs.push(dir)
    const pollingOutput = join(dir, '.env.polling')
    const webhookOutput = join(dir, '.env.webhook')
    const invalidOutput = join(dir, '.env.invalid')

    const polling = spawnSync(process.execPath, [rendererPath, pollingOutput], {
      env: { ...process.env, ...requiredEnv },
      encoding: 'utf8',
    })
    expect(polling.status, polling.stderr).toBe(0)
    expect(readFileSync(pollingOutput, 'utf8')).toContain('BOT_MODE="polling"')

    const webhook = spawnSync(process.execPath, [rendererPath, webhookOutput], {
      env: { ...process.env, ...requiredEnv, BOT_MODE: 'webhook' },
      encoding: 'utf8',
    })
    expect(webhook.status, webhook.stderr).toBe(0)
    expect(readFileSync(webhookOutput, 'utf8')).toContain('BOT_MODE="webhook"')

    const invalid = spawnSync(process.execPath, [rendererPath, invalidOutput], {
      env: { ...process.env, ...requiredEnv, BOT_MODE: 'invalid' },
      encoding: 'utf8',
    })
    expect(invalid.status).not.toBe(0)
    expect(invalid.stderr).toContain('BOT_MODE')
    expect(existsSync(invalidOutput)).toBe(false)

    const compose = readFileSync(productionComposePath, 'utf8')
    const workflow = readFileSync(workflowPath, 'utf8')
    const botEntry = readFileSync(botEntryPath, 'utf8')
    const runbook = readFileSync(deployRunbookPath, 'utf8')
    expect(compose).toContain('BOT_MODE: ${BOT_MODE:-webhook}')
    expect(workflow).toContain('BOT_MODE: ${{ vars.PRODUCTION_BOT_MODE }}')
    expect(botEntry).toContain('await bot.api.deleteWebhook().catch(() => {})')
    expect(botEntry).not.toContain('drop_pending_updates: true')
    expect(runbook).toContain('PRODUCTION_BOT_MODE')
    expect(runbook).toContain('pending updates')
  })

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

  it('installs image-bundle secrets after backup and leaves GHCR live env untouched', () => {
    const workflow = readFileSync(workflowPath, 'utf8')
    const imageBundle = readFileSync(
      fileURLToPath(new URL('../../../../scripts/deploy-image-bundle.sh', import.meta.url)),
      'utf8',
    )
    const prepare = workflow.indexOf('Prepare production env')
    const upload = workflow.indexOf('appleboy/scp-action@v1')
    const ghcrGuard = workflow.indexOf('bash .deploy/scripts/verify-ghcr-deploy-state.sh')
    const ghcrBackup = workflow.indexOf('bash .deploy/scripts/backup-local.sh')
    const activate = workflow.indexOf('deploy-image-bundle.sh deploy')
    const imageBackup = imageBundle.indexOf('bash "$helper_dir/backup-local.sh"')
    const imageInstall = imageBundle.indexOf(
      'install -m 600 "$staging/.env.production" "$env_temp"',
    )
    const pull = workflow.indexOf('docker compose -f docker-compose.prod.yml')
    const migrate = workflow.indexOf('run --rm migrate')
    const up = workflow.indexOf('up -d')

    expect(prepare).toBeGreaterThan(-1)
    expect(upload).toBeGreaterThan(prepare)
    expect(activate).toBeGreaterThan(upload)
    expect(imageInstall).toBeGreaterThan(imageBackup)
    expect(ghcrGuard).toBeGreaterThan(upload)
    expect(ghcrBackup).toBeGreaterThan(ghcrGuard)
    expect(pull).toBeGreaterThan(ghcrBackup)
    expect(workflow).not.toContain('install -m 600 .deploy/.env.production .env')
    expect(migrate).toBeGreaterThan(pull)
    expect(up).toBeGreaterThan(migrate)
  })
})

describe('image bundle workflow contract', () => {
  it('binds prod source and all release artifacts to the exact checked-out SHA', () => {
    const workflow = readFileSync(workflowPath, 'utf8')
    expect(workflow).toContain('ref: ${{ github.sha }}')
    expect(workflow).toContain('node scripts/require-prod-ref.mjs')
    expect(workflow).toContain('test "$(git rev-parse HEAD)" = "${{ github.sha }}"')
    expect(workflow).toContain(
      'bash scripts/package-release-images.sh "${{ github.sha }}" "$stage"',
    )
    expect(workflow).toContain('git bundle create "$stage/release.bundle" HEAD')
    expect(workflow).toContain('EXPECTED_RELEASE: ${{ github.sha }}')
    expect(workflow).not.toContain('docker system prune')
  })

  it('packages before secrets, stages privately, transfers separately and confirms only after smoke', () => {
    const workflow = readFileSync(workflowPath, 'utf8')
    const packageAt = workflow.indexOf('bash scripts/package-release-images.sh')
    const secretAt = workflow.indexOf('node scripts/render-production-env.mjs')
    const stageAt = workflow.indexOf('install -d -m 700 /opt/volleytime/.deploy/incoming/')
    const uploadAt = workflow.indexOf('Upload image bundle')
    const activateAt = workflow.indexOf('Activate image bundle over SSH')
    const smokeAt = workflow.indexOf('node scripts/smoke.mjs')
    const confirmAt = workflow.indexOf('deploy-image-bundle.sh confirm-smoke')
    expect(packageAt).toBeGreaterThan(-1)
    expect(secretAt).toBeGreaterThan(packageAt)
    expect(stageAt).toBeGreaterThan(secretAt)
    expect(uploadAt).toBeGreaterThan(stageAt)
    expect(activateAt).toBeGreaterThan(uploadAt)
    expect(smokeAt).toBeGreaterThan(activateAt)
    expect(confirmAt).toBeGreaterThan(smokeAt)
    expect(workflow).toContain('chmod 600 .deploy/incoming/${{ github.sha }}/.env.production')
    expect(workflow).toContain('SMOKE_BOT_TOKEN: ${{ secrets.TELEGRAM_BOT_TOKEN }}')
    expect(workflow).toContain('BOT_INTERNAL_SECRET: ${{ secrets.BOT_INTERNAL_SECRET }}')
    expect(workflow).toContain('SMOKE_TG_ID:?synthetic smoke user is required')
    expect(workflow).toContain('BOT_INTERNAL_SECRET:?synthetic smoke cleanup secret is required')
    expect(workflow).not.toContain(
      'install -m 600 .deploy/incoming/${{ github.sha }}/.env.production .env',
    )
  })

  it('rolls back only a confirmed activation after controlled smoke failure', () => {
    const workflow = readFileSync(workflowPath, 'utf8')
    expect(workflow).toContain("steps.activate.outcome == 'success'")
    expect(workflow).toContain("steps.smoke.outputs.controlled_failure == 'true'")
    expect(workflow).toContain('deploy-image-bundle.sh rollback ${{ github.sha }}')
    expect(workflow).toContain("steps.rollback.outcome == 'failure'")
    expect(workflow).toContain('Existing SHA staging requires a manual recovery checkpoint')
    expect(workflow).toContain('manual recovery checkpoint')
    expect(workflow).not.toContain('Rollback local build on failed smoke')
  })

  it('checks both destination and temporary transfer capacity before SCP', () => {
    const workflow = readFileSync(workflowPath, 'utf8')
    const metadata = workflow.indexOf('release-images.meta')
    const capacity = workflow.indexOf('Check remote transfer capacity')
    const upload = workflow.indexOf('Upload image bundle')
    expect(metadata).toBeGreaterThan(-1)
    expect(capacity).toBeGreaterThan(metadata)
    expect(upload).toBeGreaterThan(capacity)
    expect(workflow).toContain('ARCHIVE_BYTES')
    expect(workflow).toContain('payload_bytes')
    expect(workflow).toContain('UNPACKED_BYTES')
    expect(workflow).toContain('df -Pk /opt/volleytime/.deploy/incoming')
    expect(workflow).toContain('df -Pk /tmp')
    expect(workflow).toContain('df -Pk "$docker_root"')
    expect(workflow).toContain(
      'stage_required_bytes=$((payload_bytes + archive_bytes + 2 * unpacked_bytes + 268435456))',
    )
    expect(workflow).toContain('stage_required_bytes=$((stage_required_bytes + payload_bytes))')
    expect(workflow).toContain('docker info --format')
  })

  it('rejects a transfer when either filesystem is below the computed reserve', () => {
    const workflow = readFileSync(workflowPath, 'utf8')
    const step = workflow.match(
      /- name: Check remote transfer capacity[\s\S]*?(?=\n {6}- name:)/,
    )?.[0]
    expect(step).toBeDefined()
    const sha = 'a'.repeat(40)
    const script = step
      ?.split('script: |\n')[1]
      .split('\n')
      .map((line) => line.replace(/^ {12}/, ''))
      .join('\n')
      .replaceAll('${{ github.sha }}', sha)
      .replaceAll('${{ steps.transfer_size.outputs.payload_bytes }}', '1000')
      .replaceAll('${{ steps.transfer_size.outputs.archive_bytes }}', '700')
      .replaceAll('${{ steps.transfer_size.outputs.unpacked_bytes }}', '2000')
    const instrumented =
      'install() { :; }\ndocker() { echo /usr; }\nstat() { case "${@: -1}" in /tmp) echo "$TEMP_DEVICE" ;; /usr) echo "$DOCKER_DEVICE" ;; *) echo stage ;; esac; }\ndf() { local available="$STAGE_KIB"; case "${@: -1}" in /tmp) available="$TEMP_KIB" ;; /usr) available="$DOCKER_KIB" ;; esac; printf "Filesystem 1K-blocks Used Available Use%% Mounted on\\n/dev/test 999999 1 %s 1%% /fake\\n" "$available"; }\n' +
      script
    const run = (
      stageKib: number,
      tempKib: number,
      tempDevice = 'stage',
      dockerKib = stageKib,
      dockerDevice = 'stage',
    ) =>
      spawnSync(bashExecutable, ['-c', instrumented], {
        env: {
          ...process.env,
          STAGE_KIB: String(stageKib),
          TEMP_KIB: String(tempKib),
          TEMP_DEVICE: tempDevice,
          DOCKER_KIB: String(dockerKib),
          DOCKER_DEVICE: dockerDevice,
        },
        encoding: 'utf8',
      })
    // Same filesystem: stage + temporary tar + later Docker import reserve.
    const enough = run(262151, 0)
    expect(enough.status, enough.stderr).toBe(0)
    expect(run(262150, 0).status).not.toBe(0)
    // Separate /tmp: each filesystem must independently cover its copy.
    expect(run(262150, 262145, 'temp').status).toBe(0)
    expect(run(262149, 262145, 'temp').status).not.toBe(0)
    expect(run(262150, 262144, 'temp').status).not.toBe(0)
    expect(run(262150, 262145, 'temp', 262148, 'docker').status).not.toBe(0)
  })

  it('does not start deploy after workflow cancellation', () => {
    const workflow = readFileSync(workflowPath, 'utf8')
    expect(workflow).toContain('if: ${{ !cancelled() && needs.test.result')
    expect(workflow).not.toContain('if: ${{ always() && needs.test.result')
  })

  it('guards the manual GHCR path against partial-state identity before mutation', () => {
    const workflow = readFileSync(workflowPath, 'utf8')
    const ghcr = workflow.match(/- name: Deploy GHCR images over SSH[\s\S]*?(?=\n {6}- name:)/)?.[0]
    expect(ghcr).toBeDefined()
    const guard = ghcr?.indexOf('verify-ghcr-deploy-state.sh') ?? -1
    const envMutation = ghcr?.indexOf('install -m 600 .deploy/.env.production .env') ?? -1
    const backup = ghcr?.indexOf('bash .deploy/scripts/backup-local.sh') ?? -1
    expect(guard).toBeGreaterThan(-1)
    expect(envMutation).toBe(-1)
    expect(backup).toBeGreaterThan(guard)
    expect(ghcr).toContain('bash .deploy/scripts/verify-ghcr-deploy-state.sh')
  })
})

describe('manual GHCR state guard', () => {
  it('rejects the documented candidate-manifest/old-runtime partial state without mutation', () => {
    const root = mkdtempSync(join(tmpdir(), 'volleytime-ghcr-guard-'))
    dirs.push(root)
    const bin = join(root, 'bin')
    mkdirSync(bin)
    mkdirSync(join(root, '.deploy'))
    const old = 'a'.repeat(40)
    const candidate = 'b'.repeat(40)
    const manifest = (sha: string) =>
      `WEB_IMAGE=volleytime-web:${sha}\nBOT_IMAGE=volleytime-bot:${sha}\nMIGRATOR_IMAGE=volleytime-migrator:${sha}\nRELEASE_VERSION=${sha}\n`
    writeFileSync(join(root, '.env.images'), manifest(candidate))
    writeFileSync(join(root, '.env'), 'DB_PASSWORD=old\n')
    writeFileSync(join(root, '.deploy', '.env.production'), 'DB_PASSWORD=old\n')
    writeFileSync(
      join(bin, 'docker'),
      '#!/usr/bin/env bash\ncase "$1 $2" in "inspect --format") name="${@: -1}"; sha="$LIVE_SHA"; [ "$name" != vt_bot ] || sha="$BOT_SHA"; printf "true|healthy|volleytime-%s:%s\\n" "${name#vt_}" "$sha" ;; "image inspect") exit 0 ;; *) exit 1 ;; esac\n',
    )
    writeFileSync(
      join(bin, 'curl'),
      '#!/usr/bin/env bash\nprintf \'{"status":"ok","db":"ok","auth":"ok","release":"%s"}\\n\' "$LIVE_SHA"\n',
    )
    chmodSync(join(bin, 'docker'), 0o755)
    chmodSync(join(bin, 'curl'), 0o755)
    const shellRoot =
      process.platform === 'win32'
        ? root
            .replace(/^([A-Za-z]):\\/, (_match, drive: string) => `/${drive.toLowerCase()}/`)
            .replaceAll('\\', '/')
        : root
    const run = (botSha = old) =>
      spawnSync(bashExecutable, [ghcrGuardScript], {
        env: {
          ...process.env,
          PATH: `${shellRoot}/bin:/usr/bin:/mingw64/bin:${process.env.PATH ?? ''}`,
          VOLLEYTIME_ROOT: shellRoot,
          LIVE_SHA: old,
          BOT_SHA: botSha,
          CURL_BIN: `${shellRoot}/bin/curl`,
          PUBLIC_HEALTH_URL: 'https://example.invalid/api/health',
          PYTHON_BIN: process.platform === 'win32' ? 'python' : 'python3',
        },
        encoding: 'utf8',
      })

    const rejected = run()
    expect(rejected.status).not.toBe(0)
    expect(readFileSync(join(root, '.env.images'), 'utf8')).toBe(manifest(candidate))
    expect(readFileSync(join(root, '.env'), 'utf8')).toBe('DB_PASSWORD=old\n')
    writeFileSync(join(root, '.env.images'), manifest(old))
    const accepted = run()
    expect(accepted.status, accepted.stderr).toBe(0)
    expect(run(candidate).status).not.toBe(0)
    writeFileSync(join(root, '.deploy', '.env.production'), 'DB_PASSWORD=candidate\n')
    expect(run().status).not.toBe(0)
    expect(readFileSync(join(root, '.env'), 'utf8')).toBe('DB_PASSWORD=old\n')
  })
})
