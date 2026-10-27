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

// Task 9.8.18: planned VPS release retention and free-space reporting.
const deployScript = fileURLToPath(
  new URL('../../../../scripts/deploy-image-bundle.sh', import.meta.url),
)
const diskScript = fileURLToPath(new URL('../../../../scripts/disk-status.sh', import.meta.url))
const workflowPath = fileURLToPath(
  new URL('../../../../.github/workflows/deploy.yml', import.meta.url),
)
const monitorPath = fileURLToPath(
  new URL('../../../../.github/workflows/vps-disk-monitor.yml', import.meta.url),
)
const runbookPath = fileURLToPath(
  new URL('../../../../docs/operations/runbooks/deploy.md', import.meta.url),
)
const bash = process.platform === 'win32' ? 'C:\\Program Files\\Git\\bin\\bash.exe' : 'bash'
const dirs: string[] = []
const shellPath = (path: string) =>
  process.platform === 'win32'
    ? path
        .replace(/^([A-Za-z]):\\/, (_match, drive: string) => `/${drive.toLowerCase()}/`)
        .replaceAll('\\', '/')
    : path
const TIMEOUT = 35_000

afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true })
})

const services = ['web', 'bot', 'migrator'] as const
const refs = (sha: string) => services.map((service) => `volleytime-${service}:${sha}`)
const manifest = (sha: string) =>
  `WEB_IMAGE=volleytime-web:${sha}\nBOT_IMAGE=volleytime-bot:${sha}\nMIGRATOR_IMAGE=volleytime-migrator:${sha}\nRELEASE_VERSION=${sha}\n`

/**
 * Six releases r1..r6 on `prod`: r6 is live (smoke-passed), r5 is the rollback
 * target. The fake Docker store holds all their images plus foreign namespaces.
 */
function retentionFixture() {
  const root = mkdtempSync(join(tmpdir(), 'volleytime-retention-'))
  dirs.push(root)
  const repo = join(root, 'repo')
  const bin = join(root, 'bin')
  mkdirSync(join(repo, '.deploy', 'scripts'), { recursive: true })
  mkdirSync(join(repo, '.deploy', 'incoming'), { recursive: true })
  mkdirSync(bin)
  const git = (...args: string[]) => {
    const result = spawnSync('git', args, { cwd: repo, encoding: 'utf8' })
    expect(result.status, result.stderr).toBe(0)
    return result.stdout.trim()
  }
  git('init', '-b', 'prod')
  git('config', 'user.name', 'Volley Time Test')
  git('config', 'user.email', 'test@volleytime.invalid')
  writeFileSync(join(repo, '.gitignore'), '.deploy/\n.env.images*\n.env\nbackups/\n')
  writeFileSync(join(repo, 'docker-compose.prod.yml'), 'services: {}\n')
  const releases: string[] = []
  for (let n = 1; n <= 6; n++) {
    writeFileSync(join(repo, 'source'), `release ${n}\n`)
    git('add', '.')
    git('commit', '-m', `release ${n}`)
    releases.push(git('rev-parse', 'HEAD'))
  }
  const [r1, r2, r3, r4, r5, r6] = releases as [string, string, string, string, string, string]
  const foreign = 'f'.repeat(40)
  writeFileSync(join(repo, '.env'), 'DB_PASSWORD=current\n')
  writeFileSync(join(repo, '.env.images'), manifest(r6))
  writeFileSync(join(repo, '.env.images.previous'), manifest(r5))
  writeFileSync(join(repo, '.deploy', 'previous-git-sha'), `${r5}\n`)
  writeFileSync(join(repo, '.deploy', 'image-bundle-phase'), `smoke-passed ${r6}\n`)
  writeFileSync(join(repo, '.deploy', 'release-history'), [r2, r3, r4, r5, r6].join('\n') + '\n')
  for (const sha of [...releases, foreign]) {
    mkdirSync(join(repo, '.deploy', 'incoming', sha, 'scripts'), { recursive: true })
    writeFileSync(join(repo, '.deploy', 'incoming', sha, '.env.production'), 'X=1\n')
  }
  mkdirSync(join(repo, '.deploy', 'incoming', `ghcr-${r1}`))
  writeFileSync(join(repo, '.deploy', `previous-env-${r2}`), 'DB_PASSWORD=r1\n')
  mkdirSync(join(repo, 'backups'))
  writeFileSync(join(repo, 'backups', 'volleytime-r1.sql.gz'), 'backup\n')
  copyFileSync(deployScript, join(repo, '.deploy', 'scripts', 'deploy-image-bundle.sh'))

  const images = join(root, 'images')
  const containers = join(root, 'containers')
  const live = join(root, 'live')
  const calls = join(root, 'calls.log')
  const otherImages = [
    'postgres:16-alpine',
    'caddy:2-alpine',
    'volleytime-web:latest',
    `ghcr.io/trafficolog/volleytime/web:${r1}`,
    '<none>:<none>',
    `volleytime-web:${foreign}`,
  ]
  writeFileSync(images, [...releases.flatMap(refs), ...otherImages].join('\n') + '\n')
  writeFileSync(
    containers,
    [
      `volleytime-web:${r6}`,
      `volleytime-bot:${r6}`,
      'postgres:16-alpine',
      'caddy:2-alpine',
      `volleytime-migrator:${r6}`,
    ].join('\n') + '\n',
  )
  writeFileSync(live, r6)
  writeFileSync(
    join(bin, 'docker'),
    `#!/usr/bin/env bash
printf '%s\\n' "docker $*" >> "$CALLS"
case "$1 $2" in
  'inspect --format')
    case "\${@: -1}" in
      vt_web|vt_bot) service="\${@: -1}"; printf 'true|healthy|volleytime-%s:%s\\n' "\${service#vt_}" "$(cat "$LIVE_SHA")" ;;
      vt_postgres) printf 'true|healthy|postgres:16-alpine\\n' ;;
      *) exit 1 ;;
    esac ;;
  'exec vt_bot') printf '{"status":"ok","release":"%s"}\\n' "$(cat "$LIVE_SHA")" ;;
  'image ls') [ "\${FAKE_IMAGE_LS_FAIL:-0}" != 1 ] || exit 1; cat "$IMAGES" ;;
  'container ls') [ "\${FAKE_CONTAINER_LS_FAIL:-0}" != 1 ] || exit 1; cat "$CONTAINERS" ;;
  'image rm')
    ref="\${@: -1}"
    if [[ " \${FAKE_RM_FAIL:-} " == *" $ref "* ]]; then echo "conflict: image is in use" >&2; exit 1; fi
    grep -vxF -- "$ref" "$IMAGES" > "$IMAGES.next" || true
    mv -f "$IMAGES.next" "$IMAGES"
    printf 'Untagged: %s\\n' "$ref" ;;
  'info --format') exit 1 ;;
  *) exit 1 ;;
esac
`,
  )
  writeFileSync(
    join(bin, 'curl'),
    `#!/usr/bin/env bash
printf '{"status":"ok","db":"ok","auth":"ok","release":"%s"}\\n' "$(cat "$LIVE_SHA")"
`,
  )
  writeFileSync(join(bin, 'flock'), '#!/usr/bin/env bash\n[ "${FAKE_LOCK_HELD:-0}" != 1 ]\n')
  for (const name of ['docker', 'curl', 'flock']) chmodSync(join(bin, name), 0o755)
  const env = {
    ...process.env,
    PATH: `${shellPath(bin)}:/usr/bin:/mingw64/bin:${process.env.PATH ?? ''}`,
    VOLLEYTIME_ROOT: shellPath(repo),
    IMAGES: shellPath(images),
    CONTAINERS: shellPath(containers),
    LIVE_SHA: shellPath(live),
    CALLS: shellPath(calls),
    PUBLIC_HEALTH_URL: 'https://test.invalid/api/health',
    CURL_BIN: shellPath(join(bin, 'curl')),
    PYTHON_BIN: process.platform === 'win32' ? 'python' : 'python3',
  }
  const run = (args: string[], overrides: Record<string, string> = {}) =>
    spawnSync(
      bash,
      [shellPath(join(repo, '.deploy', 'scripts', 'deploy-image-bundle.sh')), ...args],
      { encoding: 'utf8', env: { ...env, ...overrides } },
    )
  const prune = (overrides: Record<string, string> = {}, extra: string[] = []) =>
    run(['prune-retained', r6, ...extra], overrides)
  const commands = () => (existsSync(calls) ? readFileSync(calls, 'utf8') : '')
  const imageStore = () => readFileSync(images, 'utf8').trim().split('\n')
  const staged = (sha: string) => existsSync(join(repo, '.deploy', 'incoming', sha))
  const write = (path: string, content: string) => writeFileSync(join(repo, path), content)
  return {
    repo,
    releases,
    r1,
    r2,
    r3,
    r4,
    r5,
    r6,
    foreign,
    otherImages,
    live,
    containers,
    run,
    prune,
    commands,
    imageStore,
    staged,
    write,
  }
}

type Fixture = ReturnType<typeof retentionFixture>

function expectNothingRemoved(f: Fixture) {
  expect(f.commands()).not.toContain('docker image rm')
  for (const sha of [...f.releases, f.foreign]) {
    expect(f.staged(sha), sha).toBe(true)
    for (const ref of refs(sha)) {
      if (sha !== f.foreign || ref.startsWith('volleytime-web:')) {
        expect(f.imageStore(), ref).toContain(ref)
      }
    }
  }
}

describe('planned release retention (prune-retained)', () => {
  it(
    'keeps current, previous, N most recent successful releases and pins; removes older ancestors',
    () => {
      const f = retentionFixture()
      f.write('.deploy/retain-pins', `# release tags\n${f.r2} # v0.2.0\n\n`)
      const result = f.prune()
      expect(result.status, result.stderr).toBe(0)
      const store = f.imageStore()
      for (const sha of [f.r2, f.r4, f.r5, f.r6]) {
        for (const ref of refs(sha)) expect(store).toContain(ref)
        expect(f.staged(sha)).toBe(true)
      }
      for (const sha of [f.r1, f.r3]) {
        for (const ref of refs(sha)) expect(store).not.toContain(ref)
        expect(f.staged(sha)).toBe(false)
      }
      expect(result.stdout).toContain(`keep ${f.r6} (current`)
      expect(result.stdout).toContain(`keep ${f.r5} (previous`)
      expect(result.stdout).toMatch(new RegExp(`keep ${f.r4} \\(.*recent`))
      expect(result.stdout).toContain(`keep ${f.r2} (pinned`)
      expect(result.stdout).toContain(`removed image volleytime-web:${f.r1}`)
      expect(result.stdout).toContain(`removed staging .deploy/incoming/${f.r3}`)
      expect(result.stdout).toMatch(/free before: .* KiB/)
      expect(result.stdout).toMatch(/free after: .* KiB/)
      expect(result.stdout).toContain('removed 6 images, 2 staging directories, 0 failures')
    },
    TIMEOUT,
  )

  it(
    'uses the configured release count',
    () => {
      const f = retentionFixture()
      f.write('.deploy/retain-releases', '1\n')
      const result = f.prune()
      expect(result.status, result.stderr).toBe(0)
      for (const sha of [f.r1, f.r2, f.r3, f.r4]) expect(f.staged(sha), sha).toBe(false)
      for (const sha of [f.r5, f.r6]) expect(f.staged(sha), sha).toBe(true)
    },
    TIMEOUT,
  )

  it(
    'never touches other namespaces, unknown SHAs, GHCR staging, backups or env snapshots',
    () => {
      const f = retentionFixture()
      const result = f.prune()
      expect(result.status, result.stderr).toBe(0)
      const store = f.imageStore()
      for (const ref of f.otherImages) expect(store).toContain(ref)
      expect(f.staged(f.foreign)).toBe(true)
      expect(f.staged(`ghcr-${f.r1}`)).toBe(true)
      expect(existsSync(join(f.repo, '.deploy', `previous-env-${f.r2}`))).toBe(true)
      expect(existsSync(join(f.repo, 'backups', 'volleytime-r1.sql.gz'))).toBe(true)
      expect(existsSync(join(f.repo, '.env.images.previous'))).toBe(true)
      const removals = f
        .commands()
        .split('\n')
        .filter((line) => line.startsWith('docker image rm'))
      expect(removals).toHaveLength(9)
      for (const line of removals) {
        expect(line).toMatch(/^docker image rm volleytime-(web|bot|migrator):[0-9a-f]{40}$/)
      }
      expect(f.commands()).not.toMatch(/system prune|image prune|builder prune| -f\b|--force/)
    },
    TIMEOUT,
  )

  it(
    'keeps every image of a release that any container (even stopped) still uses',
    () => {
      const f = retentionFixture()
      writeFileSync(
        f.containers,
        readFileSync(f.containers, 'utf8') + `volleytime-migrator:${f.r2}\n`,
      )
      const result = f.prune()
      expect(result.status, result.stderr).toBe(0)
      expect(result.stdout).toContain(`keep ${f.r2} (in-use`)
      for (const ref of refs(f.r2)) expect(f.imageStore()).toContain(ref)
      expect(f.staged(f.r2)).toBe(true)
      expect(f.staged(f.r1)).toBe(false)
    },
    TIMEOUT,
  )

  it(
    'keeps releases referenced by rollback recovery snapshots',
    () => {
      const f = retentionFixture()
      const snapshot = join(f.repo, '.deploy', '.split-recovery.abc123')
      mkdirSync(snapshot)
      writeFileSync(join(snapshot, 'manifest'), manifest(f.r1))
      writeFileSync(join(snapshot, 'git-sha'), `${f.r3}\n`)
      const result = f.prune()
      expect(result.status, result.stderr).toBe(0)
      expect(f.staged(f.r1)).toBe(true)
      expect(f.staged(f.r3)).toBe(true)
      expect(f.staged(f.r2)).toBe(false)
    },
    TIMEOUT,
  )

  it(
    'keeps releases referenced by GHCR rollback snapshots',
    () => {
      const f = retentionFixture()
      f.write(`.deploy/ghcr-old-manifest-${f.r3}`, manifest(f.r2))
      const result = f.prune()
      expect(result.status, result.stderr).toBe(0)
      expect(result.stdout).toContain(`keep ${f.r2} (ghcr-recovery`)
      for (const ref of refs(f.r2)) expect(f.imageStore()).toContain(ref)
      expect(f.staged(f.r2)).toBe(true)
      expect(f.staged(f.r1)).toBe(false)
    },
    TIMEOUT,
  )

  it(
    'a failed image removal is a warning: the run succeeds and that release staging stays',
    () => {
      const f = retentionFixture()
      const result = f.prune({ FAKE_RM_FAIL: `volleytime-web:${f.r1}` })
      expect(result.status, result.stderr).toBe(0)
      expect(result.stderr).toContain(`warning: failed to remove image volleytime-web:${f.r1}`)
      expect(f.staged(f.r1)).toBe(true)
      expect(f.staged(f.r2)).toBe(false)
      expect(result.stdout).toContain('1 failures')
    },
    TIMEOUT,
  )

  it(
    'dry run prints the plan and removes nothing',
    () => {
      const f = retentionFixture()
      const result = f.prune({}, ['--dry-run'])
      expect(result.status, result.stderr).toBe(0)
      expect(result.stdout).toContain(`would remove image volleytime-web:${f.r1}`)
      expect(result.stdout).toContain(`would remove staging .deploy/incoming/${f.r3}`)
      expectNothingRemoved(f)
    },
    TIMEOUT,
  )

  const failSafe: [string, (f: Fixture) => Record<string, string>][] = [
    [
      'an unfinished phase',
      (f) => (f.write('.deploy/image-bundle-phase', `activated ${f.r6}\n`), {}),
    ],
    [
      'a phase of another SHA',
      (f) => (f.write('.deploy/image-bundle-phase', `smoke-passed ${f.r5}\n`), {}),
    ],
    ['a missing phase', (f) => (rmSync(join(f.repo, '.deploy', 'image-bundle-phase')), {})],
    [
      'a missing previous pointer',
      (f) => (rmSync(join(f.repo, '.deploy', 'previous-git-sha')), {}),
    ],
    ['a previous manifest mismatch', (f) => (f.write('.env.images.previous', manifest(f.r4)), {})],
    ['a current manifest mismatch', (f) => (f.write('.env.images', manifest(f.r5)), {})],
    ['a live runtime mismatch', (f) => (writeFileSync(f.live, f.r5), {})],
    [
      'a malformed history',
      (f) => (f.write('.deploy/release-history', `${f.r6}\nnot-a-sha\n`), {}),
    ],
    [
      'a history shorter than N',
      (f) => (f.write('.deploy/release-history', `${f.r5}\n${f.r6}\n`), {}),
    ],
    [
      'an unreadable GHCR rollback snapshot',
      (f) => (f.write(`.deploy/ghcr-old-manifest-${f.r3}`, 'garbage\n'), {}),
    ],
    ['a malformed pin', (f) => (f.write('.deploy/retain-pins', 'v0.2.0\n'), {})],
    ['a zero release count', (f) => (f.write('.deploy/retain-releases', '0\n'), {})],
    ['a non-numeric release count', (f) => (f.write('.deploy/retain-releases', 'three\n'), {})],
    ['an image listing failure', () => ({ FAKE_IMAGE_LS_FAIL: '1' })],
    ['a container listing failure', () => ({ FAKE_CONTAINER_LS_FAIL: '1' })],
    ['a held deploy lock', () => ({ FAKE_LOCK_HELD: '1' })],
  ]
  it.each(failSafe)(
    'removes nothing and still exits 0 on %s',
    (_name, arrange) => {
      const f = retentionFixture()
      const overrides = arrange(f)
      const result = f.prune(overrides)
      expect(result.status, result.stderr).toBe(0)
      expect(result.stderr).toMatch(/image-bundle prune: warning: .*nothing removed/)
      expectNothingRemoved(f)
    },
    TIMEOUT,
  )

  it(
    'rejects unknown arguments without touching state',
    () => {
      const f = retentionFixture()
      const result = f.run(['prune-retained', f.r6, '--force'])
      expect(result.status).not.toBe(0)
      expectNothingRemoved(f)
    },
    TIMEOUT,
  )
})

describe('successful release history', () => {
  it(
    'confirm-smoke appends the confirmed SHA once',
    () => {
      const f = retentionFixture()
      f.write('.deploy/image-bundle-phase', `activated ${f.r6}\n`)
      f.write('.deploy/release-history', `${f.r4}\n${f.r5}\n`)
      const history = join(f.repo, '.deploy', 'release-history')
      const first = f.run(['confirm-smoke', f.r6])
      expect(first.status, first.stderr).toBe(0)
      expect(readFileSync(history, 'utf8')).toBe(`${f.r4}\n${f.r5}\n${f.r6}\n`)
      const again = f.run(['confirm-smoke', f.r6])
      expect(again.status, again.stderr).toBe(0)
      expect(readFileSync(history, 'utf8')).toBe(`${f.r4}\n${f.r5}\n${f.r6}\n`)
      expect(f.commands()).not.toContain('docker image rm')
    },
    TIMEOUT,
  )

  it(
    'confirm-smoke keeps a hand-seeded history without a final newline valid',
    () => {
      const f = retentionFixture()
      f.write('.deploy/image-bundle-phase', `activated ${f.r6}\n`)
      f.write('.deploy/release-history', `${f.r4}\n${f.r5}`)
      const result = f.run(['confirm-smoke', f.r6])
      expect(result.status, result.stderr).toBe(0)
      expect(readFileSync(join(f.repo, '.deploy', 'release-history'), 'utf8')).toBe(
        `${f.r4}\n${f.r5}\n${f.r6}\n`,
      )
    },
    TIMEOUT,
  )

  it(
    'confirm-smoke starts the history when it is absent',
    () => {
      const f = retentionFixture()
      f.write('.deploy/image-bundle-phase', `activated ${f.r6}\n`)
      rmSync(join(f.repo, '.deploy', 'release-history'))
      const result = f.run(['confirm-smoke', f.r6])
      expect(result.status, result.stderr).toBe(0)
      expect(readFileSync(join(f.repo, '.deploy', 'release-history'), 'utf8')).toBe(`${f.r6}\n`)
    },
    TIMEOUT,
  )
})

function diskStatus(input: string, args: string[] = [], env: Record<string, string> = {}) {
  const root = mkdtempSync(join(tmpdir(), 'volleytime-disk-'))
  dirs.push(root)
  const summary = join(root, 'summary.md')
  const result = spawnSync(bash, [shellPath(diskScript), ...args], {
    input,
    encoding: 'utf8',
    env: { ...process.env, GITHUB_STEP_SUMMARY: shellPath(summary), ...env },
  })
  return { ...result, summary: existsSync(summary) ? readFileSync(summary, 'utf8') : '' }
}

const GIB = 1024 * 1024
const df = (rows: [string, number, number, string][]) =>
  [
    'Filesystem     1024-blocks     Used Available Capacity Mounted on',
    ...rows.map(
      ([fs, size, avail, mount]) =>
        `${fs} ${size} ${size - avail} ${avail} ${Math.round(((size - avail) * 100) / size)}% ${mount}`,
    ),
  ].join('\n') + '\n'

describe('VPS disk status report', () => {
  it('reports healthy free space without a warning', () => {
    const r = diskStatus(df([['/dev/vda1', 28 * GIB, 14 * GIB, '/']]))
    expect(r.status, r.stderr).toBe(0)
    expect(r.stdout).not.toContain('::warning::')
    expect(r.summary).toContain('| /dev/vda1 | / | 28.0 GiB | 14.0 GiB | 50% | ok |')
    expect(r.summary).toContain('25%')
    expect(r.summary).toContain('5 GiB')
  })

  it('warns below 25% free even with more than 5 GiB free', () => {
    const r = diskStatus(df([['/dev/vda1', 28 * GIB, 6 * GIB, '/']]))
    expect(r.status, r.stderr).toBe(0)
    expect(r.stdout).toContain('::warning::')
    expect(r.summary).toContain('| low |')
  })

  it('warns below 5 GiB free even above 25%', () => {
    const r = diskStatus(df([['/dev/vdb1', 10 * GIB, 4 * GIB, '/data']]))
    expect(r.status, r.stderr).toBe(0)
    expect(r.stdout).toContain('::warning::VPS disk low: /data')
  })

  it('reports one row per filesystem', () => {
    const line: [string, number, number, string] = ['/dev/vda1', 28 * GIB, 14 * GIB, '/']
    const r = diskStatus(df([line]) + df([line]))
    expect(r.status, r.stderr).toBe(0)
    expect(r.summary.match(/\| \/dev\/vda1 \|/g)).toHaveLength(1)
  })

  it('fails when no disk data is available', () => {
    const r = diskStatus('ssh: connect to host timed out\n')
    expect(r.status).toBe(1)
    expect(r.stdout).toContain('::error::')
    expect(r.summary).toContain('unavailable')
  })

  it('fails on low space only with --fail-on-low', () => {
    const low = df([['/dev/vda1', 28 * GIB, 2 * GIB, '/']])
    expect(diskStatus(low).status).toBe(0)
    expect(diskStatus(low, ['--fail-on-low']).status).toBe(2)
    expect(diskStatus(df([['/dev/vda1', 28 * GIB, 14 * GIB, '/']]), ['--fail-on-low']).status).toBe(
      0,
    )
  })

  it('honours threshold overrides and rejects invalid ones', () => {
    const half = df([['/dev/vda1', 28 * GIB, 14 * GIB, '/']])
    expect(diskStatus(half, [], { DISK_MIN_FREE_PCT: '60' }).stdout).toContain('::warning::')
    expect(diskStatus(half, [], { DISK_MIN_FREE_GIB: 'x' }).status).toBe(1)
  })
})

const step = (workflow: string, name: string) =>
  workflow.match(new RegExp(`- name: ${name}[\\s\\S]*?(?=\\n {6}- name:|$)`))?.[0] ?? ''

describe('retention and disk monitoring workflow wiring', () => {
  it('prunes only after confirmed smoke and never fails the deploy', () => {
    const workflow = readFileSync(workflowPath, 'utf8')
    const confirm = step(workflow, 'Confirm synthetic smoke over SSH')
    expect(confirm).toContain('id: confirm')
    const prune = step(workflow, 'Prune retained releases over SSH')
    expect(prune).toContain("if: ${{ steps.confirm.outcome == 'success' }}")
    expect(prune).toContain('continue-on-error: true')
    expect(prune).toContain('command_timeout:')
    expect(prune).toContain(
      'bash .deploy/incoming/${{ github.sha }}/scripts/deploy-image-bundle.sh prune-retained ${{ github.sha }}',
    )
    expect(workflow.indexOf('Prune retained releases over SSH')).toBeGreaterThan(
      workflow.indexOf('Confirm synthetic smoke over SSH'),
    )
    expect(workflow).not.toMatch(/docker (system|image) prune/)
  })

  it('records VPS free space in the job summary on every outcome', () => {
    const workflow = readFileSync(workflowPath, 'utf8')
    const read = step(workflow, 'Read VPS disk usage')
    expect(read).toContain('if: ${{ always() }}')
    expect(read).toContain('continue-on-error: true')
    expect(read).toContain('capture_stdout: true')
    expect(read).toContain('df -Pk /opt/volleytime')
    expect(read).not.toMatch(/\brm\b|prune|image rm/)
    const report = step(workflow, 'Report VPS disk in job summary')
    expect(report).toContain('if: ${{ always() }}')
    expect(report).toContain('DF_OUTPUT: ${{ steps.vps_disk.outputs.stdout }}')
    expect(report).toContain(
      String.raw`run: printf '%s\n' "$DF_OUTPUT" | bash scripts/disk-status.sh`,
    )
    expect(report).toMatch(/disk-status\.sh\n*$/)
    expect(report).not.toContain('--fail-on-low')
  })

  it('checks VPS disk on a schedule with read-only commands and existing secrets', () => {
    const monitor = readFileSync(monitorPath, 'utf8')
    expect(monitor).toMatch(/schedule:\n\s+- cron: '[^']+'/)
    expect(monitor).toContain('workflow_dispatch:')
    expect(monitor).toMatch(/permissions:\n\s+contents: read/)
    expect(monitor).not.toContain('environment:')
    expect(monitor).toContain('capture_stdout: true')
    expect(monitor).toContain(
      String.raw`run: printf '%s\n' "$DF_OUTPUT" | bash scripts/disk-status.sh --fail-on-low` +
        '\n',
    )
    expect(monitor).not.toMatch(/\brm\b|prune|image rm|compose/)
    const secrets = [...monitor.matchAll(/secrets\.([A-Z_]+)/g)].map((m) => m[1])
    expect(new Set(secrets)).toEqual(new Set(['VPS_HOST', 'VPS_SSH_KEY', 'TELEGRAM_BOT_TOKEN']))
    const alert = step(monitor, 'Alert owner in Telegram')
    expect(alert).toContain("vars.OPS_ALERT_TELEGRAM_CHAT_ID != ''")
    expect(alert).toContain('failure()')
  })

  it('documents the retention policy and keeps blind pruning forbidden', () => {
    const runbook = readFileSync(runbookPath, 'utf8')
    expect(runbook).toContain('prune-retained')
    expect(runbook).toContain('.deploy/retain-pins')
    expect(runbook).toContain('.deploy/retain-releases')
    expect(runbook).toContain('.deploy/release-history')
    expect(runbook).toContain('--dry-run')
    expect(runbook).toContain('vps-disk-monitor.yml')
    expect(runbook).not.toContain(
      'Do not prune runner/VPS images to make a failing capacity gate pass',
    )
    expect(runbook).toMatch(/[Bb]lind pruning/)
  })
})
