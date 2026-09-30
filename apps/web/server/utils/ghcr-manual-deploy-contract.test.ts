import { spawnSync } from 'node:child_process'
import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { afterEach, describe, expect, it } from 'vitest'

const rootFile = (path: string) => fileURLToPath(new URL(`../../../../${path}`, import.meta.url))
const bash = process.platform === 'win32' ? 'C:\\Program Files\\Git\\bin\\bash.exe' : 'bash'
const shellPath = (path: string) =>
  process.platform === 'win32'
    ? path
        .replace(/^([A-Za-z]):\\/, (_match, drive: string) => `/${drive.toLowerCase()}/`)
        .replaceAll('\\', '/')
    : path
const dirs: string[] = []
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true })
})

function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'volleytime-ghcr-manual-'))
  dirs.push(root)
  const repo = join(root, 'repo')
  const bin = join(root, 'bin')
  mkdirSync(join(repo, '.deploy', 'scripts'), { recursive: true })
  mkdirSync(bin)
  const git = (...args: string[]) => {
    const result = spawnSync('git', args, { cwd: repo, encoding: 'utf8' })
    expect(result.status, result.stderr).toBe(0)
    return result.stdout.trim()
  }
  git('init', '-b', 'prod')
  git('config', 'user.name', 'Volley Time Test')
  git('config', 'user.email', 'test@volleytime.invalid')
  writeFileSync(join(repo, '.gitignore'), '.deploy/\n.env\n.env.images*\n')
  writeFileSync(join(repo, 'source'), 'prior\n')
  writeFileSync(join(repo, 'docker-compose.prod.yml'), 'services: {}\n')
  git('add', '.')
  git('commit', '-m', 'prior')
  const prior = git('rev-parse', 'HEAD')
  writeFileSync(join(repo, 'source'), 'old\n')
  git('commit', '-am', 'old')
  const old = git('rev-parse', 'HEAD')
  writeFileSync(join(repo, 'source'), 'next\n')
  git('commit', '-am', 'next')
  const next = git('rev-parse', 'HEAD')
  const staging = join(repo, '.deploy', 'incoming', `ghcr-${next}`)
  mkdirSync(join(staging, 'scripts'), { recursive: true })
  git('bundle', 'create', join(staging, 'release.bundle'), 'prod')
  git('reset', '--hard', old)

  const manifest = (sha: string, prefix = 'volleytime') =>
    `WEB_IMAGE=${prefix === 'volleytime' ? 'volleytime-web' : `${prefix}/web`}:${sha}\nBOT_IMAGE=${prefix === 'volleytime' ? 'volleytime-bot' : `${prefix}/bot`}:${sha}\nMIGRATOR_IMAGE=${prefix === 'volleytime' ? 'volleytime-migrator' : `${prefix}/migrator`}:${sha}\nRELEASE_VERSION=${sha}\n`
  writeFileSync(join(repo, '.env'), 'DB_PASSWORD=old\n')
  writeFileSync(join(staging, '.env.production'), 'DB_PASSWORD=old\n')
  // An unrelated attempt's env must never be used by this helper.
  writeFileSync(join(repo, '.deploy', '.env.production'), 'DB_PASSWORD=unrelated\n')
  writeFileSync(join(repo, '.env.images'), manifest(old))
  writeFileSync(join(repo, '.env.images.previous'), manifest(prior))
  writeFileSync(join(repo, '.deploy', 'previous-git-sha'), `${prior}\n`)
  for (const name of [
    'deploy-ghcr-manual.sh',
    'verify-ghcr-deploy-state.sh',
    'release-bundle.sh',
  ]) {
    if (existsSync(rootFile(`scripts/${name}`))) {
      copyFileSync(rootFile(`scripts/${name}`), join(staging, 'scripts', name))
    }
  }
  const web = join(root, 'web')
  const bot = join(root, 'bot')
  const calls = join(root, 'calls.log')
  writeFileSync(web, `volleytime-web:${old}`)
  writeFileSync(bot, `volleytime-bot:${old}`)
  writeFileSync(
    join(bin, 'docker'),
    `#!/usr/bin/env bash
printf '%s\\n' "docker $*" >> "$CALLS"
case "$1 $2" in
  'image inspect') exit 0 ;;
  'inspect --format')
    name="\${@: -1}"
    case "$name" in vt_web) image="$(cat "$WEB_STATE")" ;; vt_bot) image="$(cat "$BOT_STATE")" ;; *) exit 1 ;; esac
    status=healthy
    if [ -f "$ROOT_PATH/.deploy/readiness-$name" ]; then
      remaining="$(cat "$ROOT_PATH/.deploy/readiness-$name")"
      if [ "$remaining" -gt 0 ]; then
        status=starting
        printf '%s' "$((remaining - 1))" > "$ROOT_PATH/.deploy/readiness-$name"
      fi
    fi
    printf 'runtime-health %s %s\\n' "$name" "$status" >> "$CALLS"
    printf 'true|%s|%s\\n' "$status" "$image"
    ;;
  'compose -f')
    if [[ "$*" == *' pull'* ]] && [ "\${FAKE_PULL_FAIL:-0}" = 1 ]; then exit 1; fi
    if [[ "$*" == *'run --rm migrate'* ]]; then printf 'migrate-head %s\\n' "$(git -C "$ROOT_PATH" rev-parse HEAD)" >> "$CALLS"; fi
    if [[ "$*" == *'run --rm migrate'* ]] && [ "\${FAKE_MIGRATE_FAIL:-0}" != 0 ]; then exit "$FAKE_MIGRATE_FAIL"; fi
    if [[ "$*" == *'up --no-build -d web bot'* ]]; then
      target="$(sed -n 's/^RELEASE_VERSION=//p' "$ROOT_PATH/.env.images")"
      if [ "$target" = "$NEXT_SHA" ] && [ "\${FAKE_UP_FAIL:-0}" = 1 ]; then
        printf 'ghcr.io/example/repo/web:%s' "$NEXT_SHA" > "$WEB_STATE"
        exit 1
      fi
      sed -n 's/^WEB_IMAGE=//p' "$ROOT_PATH/.env.images" > "$WEB_STATE"
      sed -n 's/^BOT_IMAGE=//p' "$ROOT_PATH/.env.images" > "$BOT_STATE"
      for name in vt_web vt_bot; do printf '%s' "\${FAKE_STARTING_CHECKS:-0}" > "$ROOT_PATH/.deploy/readiness-$name"; done
    fi
    ;;
esac
`,
  )
  writeFileSync(
    join(bin, 'curl'),
    `#!/usr/bin/env bash
image="$(cat "$WEB_STATE")"
sha="\${image##*:}"
printf 'public-health %s\\n' "$sha" >> "$CALLS"
if [ "$sha" = "$NEXT_SHA" ] && [ "\${FAKE_HEALTH_INTERRUPT:-0}" = 1 ]; then exit 124; fi
if [ "$sha" = "$NEXT_SHA" ] && [ "\${FAKE_PUBLIC_FAIL:-0}" = 1 ]; then exit 22; fi
printf '{"status":"ok","db":"ok","auth":"ok","release":"%s"}\\n' "$sha"
`,
  )
  writeFileSync(join(bin, 'flock'), '#!/usr/bin/env bash\nexit 0\n')
  writeFileSync(
    join(bin, 'install'),
    '#!/usr/bin/env bash\nif [ "$1" = -d ]; then mkdir -p "${@: -1}"; else cp "${@: -2:1}" "${@: -1}"; fi\n',
  )
  writeFileSync(
    join(staging, 'scripts', 'backup-local.sh'),
    '#!/usr/bin/env bash\nprintf "backup\\n" >> "$CALLS"\n',
  )
  for (const name of ['docker', 'curl', 'flock', 'install']) chmodSync(join(bin, name), 0o755)
  const env = {
    ...process.env,
    PATH: `${shellPath(bin)}:/usr/bin:/mingw64/bin:${process.env.PATH ?? ''}`,
    VOLLEYTIME_ROOT: shellPath(repo),
    ROOT_PATH: shellPath(repo),
    WEB_STATE: shellPath(web),
    BOT_STATE: shellPath(bot),
    CALLS: shellPath(calls),
    NEXT_SHA: next,
    GHCR_HEALTH_ATTEMPTS: '5',
    GHCR_HEALTH_SLEEP_SECONDS: '0',
    PUBLIC_HEALTH_URL: 'https://test.invalid/api/health',
    CURL_BIN: shellPath(join(bin, 'curl')),
    PYTHON_BIN: process.platform === 'win32' ? 'python' : 'python3',
  }
  const run = (mode = 'deploy', overrides: Record<string, string> = {}) => {
    if (overrides.FAKE_WRONG_BUNDLE === '1') {
      writeFileSync(join(staging, 'release.bundle'), 'not a bundle')
    }
    return spawnSync(
      bash,
      [
        '-c',
        'PATH="$1:$PATH"; shift; exec bash "$@"',
        'fixture',
        shellPath(bin),
        shellPath(join(staging, 'scripts', 'deploy-ghcr-manual.sh')),
        mode,
        ...(mode === 'deploy' ? [shellPath(staging), next, 'ghcr.io/example/repo'] : [next]),
      ],
      { encoding: 'utf8', env: { ...env, ...overrides } },
    )
  }
  const readCalls = () => (existsSync(calls) ? readFileSync(calls, 'utf8') : '')
  return { repo, old, prior, next, git, manifest, web, bot, run, readCalls }
}

describe('manual GHCR deploy recovery', () => {
  it('waits for starting candidate containers to become healthy', () => {
    const f = fixture()
    const result = f.run('deploy', { FAKE_STARTING_CHECKS: '1' })
    expect(result.status, result.stderr).toBe(0)
    expect(f.git('rev-parse', 'HEAD')).toBe(f.next)
    expect(f.readCalls()).toContain(`public-health ${f.next}`)
    expect(f.readCalls()).toContain('runtime-health vt_web starting')
    expect(f.readCalls()).toContain('runtime-health vt_bot starting')
  }, 15000)

  it('waits for restored containers before completing rollback and restoring history', () => {
    const f = fixture()
    expect(f.run().status).toBe(0)
    const rollback = f.run('rollback', { FAKE_STARTING_CHECKS: '1' })
    expect(rollback.status, rollback.stderr).toBe(0)
    expect(f.readCalls()).toContain('runtime-health vt_web starting')
    expect(f.readCalls()).toContain('runtime-health vt_bot starting')
    expect(f.readCalls()).toContain(`public-health ${f.old}`)
    expect(f.git('rev-parse', 'HEAD')).toBe(f.old)
    expect(readFileSync(join(f.repo, '.env.images.previous'), 'utf8')).toBe(f.manifest(f.prior))
    expect(readFileSync(join(f.repo, '.deploy', 'previous-git-sha'), 'utf8')).toBe(`${f.prior}\n`)
  }, 15000)

  it('restores old history when candidate readiness exhausts its bounded attempts', () => {
    const f = fixture()
    const result = f.run('deploy', { FAKE_PUBLIC_FAIL: '1' })
    expect(result.status).not.toBe(0)
    expect(result.stderr).toContain('readiness exhausted')
    expect(f.git('rev-parse', 'HEAD')).toBe(f.old)
    expect(readFileSync(join(f.repo, '.env.images.previous'), 'utf8')).toBe(f.manifest(f.prior))
    expect(readFileSync(join(f.repo, '.deploy', 'previous-git-sha'), 'utf8')).toBe(`${f.prior}\n`)
    expect(f.readCalls().match(new RegExp(`public-health ${f.next}`, 'g'))).toHaveLength(5)
  }, 15000)

  it('requires a manual checkpoint instead of rollback after readiness interruption', () => {
    const f = fixture()
    const result = f.run('deploy', { FAKE_HEALTH_INTERRUPT: '1' })
    expect(result.status).not.toBe(0)
    expect(result.stderr).toContain('manual recovery checkpoint')
    expect(f.git('rev-parse', 'HEAD')).toBe(f.next)
    expect(f.readCalls().match(/up --no-build -d web bot/g)).toHaveLength(1)
  }, 15000)
  it.each([
    ['pull', { FAKE_PULL_FAIL: '1' }],
    ['migration', { FAKE_MIGRATE_FAIL: '1' }],
    ['up', { FAKE_UP_FAIL: '1' }],
  ])(
    'restores exact old state after controlled %s failure',
    (_name, env) => {
      const f = fixture()
      const result = f.run('deploy', env)
      expect(result.status, result.stderr).not.toBe(0)
      expect(f.git('rev-parse', 'HEAD')).toBe(f.old)
      expect(readFileSync(join(f.repo, '.env.images'), 'utf8')).toBe(f.manifest(f.old))
      expect(readFileSync(join(f.repo, '.env.images.previous'), 'utf8')).toBe(f.manifest(f.prior))
      expect(readFileSync(join(f.repo, '.deploy', 'previous-git-sha'), 'utf8')).toBe(`${f.prior}\n`)
      expect(readFileSync(join(f.repo, '.env'), 'utf8')).toBe('DB_PASSWORD=old\n')
      expect(readFileSync(f.web, 'utf8').trim()).toBe(`volleytime-web:${f.old}`)
      expect(readFileSync(f.bot, 'utf8').trim()).toBe(`volleytime-bot:${f.old}`)
      const calls = f.readCalls()
      expect(calls.indexOf('backup')).toBeLessThan(calls.indexOf('pull'))
      if (_name !== 'pull') expect(calls).toContain(`migrate-head ${f.next}`)
      if (_name === 'up') expect(calls).toContain('up --no-build -d web bot')
      expect(result.stderr).toContain('manual recovery checkpoint')
      expect(calls).not.toMatch(/docker (?:build|image prune|system prune)/)
    },
    15000,
  )

  it('advances the verified bundle before migration and can explicitly roll back', () => {
    const f = fixture()
    const result = f.run()
    expect(result.status, result.stderr).toBe(0)
    expect(f.git('rev-parse', 'HEAD')).toBe(f.next)
    expect(readFileSync(join(f.repo, '.env.images'), 'utf8')).toBe(
      f.manifest(f.next, 'ghcr.io/example/repo'),
    )
    expect(readFileSync(join(f.repo, '.deploy', 'previous-git-sha'), 'utf8')).toBe(`${f.old}\n`)
    expect(f.readCalls().indexOf('pull')).toBeLessThan(f.readCalls().indexOf('run --rm migrate'))
    expect(f.readCalls()).toContain(`migrate-head ${f.next}`)
    const rollback = f.run('rollback')
    expect(rollback.status, rollback.stderr).toBe(0)
    expect(f.git('rev-parse', 'HEAD')).toBe(f.old)
    expect(readFileSync(join(f.repo, '.env.images'), 'utf8')).toBe(f.manifest(f.old))
    expect(readFileSync(f.web, 'utf8').trim()).toBe(`volleytime-web:${f.old}`)
    expect(readFileSync(join(f.repo, '.env.images.previous'), 'utf8')).toBe(f.manifest(f.prior))
    expect(readFileSync(join(f.repo, '.deploy', 'previous-git-sha'), 'utf8')).toBe(`${f.prior}\n`)
  }, 15000)

  it('requires a manual checkpoint after ambiguous migration timeout', () => {
    const f = fixture()
    const result = f.run('deploy', { FAKE_MIGRATE_FAIL: '124' })
    expect(result.status).not.toBe(0)
    expect(result.stderr).toContain('manual recovery checkpoint')
    expect(f.git('rev-parse', 'HEAD')).toBe(f.next)
    expect(readFileSync(join(f.repo, '.env.images'), 'utf8')).toBe(
      f.manifest(f.next, 'ghcr.io/example/repo'),
    )
    expect(f.readCalls()).not.toContain('up --no-build')
  }, 15000)

  it('rejects an unrelated bundle before backup or manifest changes', () => {
    const f = fixture()
    const result = f.run('deploy', { FAKE_WRONG_BUNDLE: '1' })
    expect(result.status).not.toBe(0)
    expect(f.readCalls()).not.toContain('backup')
    expect(f.git('rev-parse', 'HEAD')).toBe(f.old)
    expect(readFileSync(join(f.repo, '.env.images'), 'utf8')).toBe(f.manifest(f.old))
  })
})
