import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { gunzipSync } from 'node:zlib'

import { afterEach, describe, expect, it } from 'vitest'

const script = fileURLToPath(
  new URL('../../../../scripts/package-release-images.sh', import.meta.url),
)
const verifyScript = fileURLToPath(
  new URL('../../../../scripts/verify-release-images.sh', import.meta.url),
)
const deployScript = fileURLToPath(
  new URL('../../../../scripts/deploy-image-bundle.sh', import.meta.url),
)
const workflow = readFileSync(
  fileURLToPath(new URL('../../../../.github/workflows/deploy.yml', import.meta.url)),
  'utf8',
)
const bash = process.platform === 'win32' ? 'C:\\Program Files\\Git\\bin\\bash.exe' : 'bash'
const dirs: string[] = []
const shellPath = (path: string) =>
  process.platform === 'win32'
    ? path
        .replace(/^([A-Za-z]):\\/, (_match, drive: string) => `/${drive.toLowerCase()}/`)
        .replaceAll('\\', '/')
    : path

function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'volleytime-package-images-'))
  dirs.push(root)
  const repo = join(root, 'repo')
  mkdirSync(join(repo, 'scripts'), { recursive: true })
  copyFileSync(script, join(repo, 'scripts', 'package-release-images.sh'))
  for (const dockerfile of [
    'apps/web/Dockerfile',
    'apps/bot/Dockerfile',
    'docker/migrator.Dockerfile',
  ]) {
    const path = join(repo, dockerfile)
    mkdirSync(join(path, '..'), { recursive: true })
    writeFileSync(path, 'FROM scratch\n')
  }
  writeFileSync(join(repo, '.gitignore'), '.output/\n.superpowers/\n')
  const git = (...args: string[]) => {
    const result = spawnSync('git', args, { cwd: repo, encoding: 'utf8' })
    expect(result.status, result.stderr).toBe(0)
    return result.stdout.trim()
  }
  git('init', '-b', 'prod')
  git('config', 'user.name', 'Volley Time Test')
  git('config', 'user.email', 'test@volleytime.invalid')
  git('add', '.')
  git('commit', '-m', 'fixture')
  const sha = git('rev-parse', 'HEAD')
  const bin = join(root, 'bin')
  const output = join(root, 'output')
  mkdirSync(bin)
  writeFileSync(
    join(bin, 'docker'),
    `#!/usr/bin/env bash
printf '%s\\n' "$*" >> "$DOCKER_CALLS"
case "$1 $2" in
  'image inspect')
    tag="\${@: -1}"
    printf '%s|%s|%s\\n' "\${FAKE_ARCH:-amd64}" "\${FAKE_REVISION:-$RELEASE_SHA}" "\${FAKE_TAG:-$tag}"
    ;;
  'save -o')
    [ "\${FAKE_SAVE_FAILURE:-0}" != 1 ] || exit 41
    printf 'fake docker archive\\n' > "$3"
    ;;
  'run --rm')
    [ "\${FAKE_RUN_FAILURE:-0}" != 1 ] || exit 44
    ;;
esac
if [ "$1" = build ]; then
  [ ! -e "\${@: -1}/.output/build.js" ] || exit 42
  [ ! -e "\${@: -1}/.superpowers/sdd/secret.txt" ] || exit 43
fi
`,
  )
  chmodSync(join(bin, 'docker'), 0o755)
  const calls = join(root, 'calls.log')
  const env = {
    ...process.env,
    PATH: `${shellPath(bin)}:/usr/bin:/mingw64/bin`,
    DOCKER_CALLS: shellPath(calls),
    RELEASE_SHA: sha,
    DB_PASSWORD: 'never-print-this-secret',
  }
  const run = (expectedSha = sha, overrides: Record<string, string> = {}) =>
    spawnSync(
      bash,
      [
        shellPath(join(repo, 'scripts', 'package-release-images.sh')),
        expectedSha,
        shellPath(output),
      ],
      {
        env: { ...env, ...overrides },
        encoding: 'utf8',
      },
    )
  const commands = () => (existsSync(calls) ? readFileSync(calls, 'utf8') : '')
  return { repo, sha, output, run, commands }
}

afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true })
})

describe('runner image bundle packaging', () => {
  it.each(['a16eb2a', 'g'.repeat(40), 'A'.repeat(40)])(
    'rejects invalid full SHA %s before invoking Docker',
    (badSha) => {
      const f = fixture()
      const result = f.run(badSha)
      expect(result.status).not.toBe(0)
      expect(result.stderr).toContain('full 40-character lowercase SHA')
      expect(f.commands()).toBe('')
      expect(existsSync(join(f.output, 'release-images.meta'))).toBe(false)
    },
  )

  it('builds three amd64 SHA-labelled images and publishes matching private artifacts', () => {
    const f = fixture()
    const sha = f.sha
    const result = f.run()
    expect(result.status, result.stderr).toBe(0)
    const calls = f.commands().trim().split('\n')
    expect(calls).toHaveLength(8)
    for (const [name, dockerfile] of [
      ['web', 'apps/web/Dockerfile'],
      ['bot', 'apps/bot/Dockerfile'],
      ['migrator', 'docker/migrator.Dockerfile'],
    ]) {
      expect(calls).toContainEqual(
        expect.stringMatching(
          new RegExp(
            `^build --platform linux/amd64 --label org.opencontainers.image.revision=${sha} -f .*/${dockerfile} -t volleytime-${name}:${sha} .*/\\.release-context\\.[^ ]+$`,
          ),
        ),
      )
      expect(calls).toContain(
        `image inspect --format {{.Architecture}}|{{index .Config.Labels "org.opencontainers.image.revision"}}|{{join .RepoTags ","}} volleytime-${name}:${sha}`,
      )
    }
    expect(calls[6]).toBe(
      `run --rm --network none --entrypoint node volleytime-migrator:${sha} ./node_modules/tsx/dist/cli.mjs --version`,
    )
    expect(calls[7]).toMatch(
      new RegExp(
        `^save -o ${shellPath(f.output)}/\\.release-images\\.[^ ]+\\.tar volleytime-web:${sha} volleytime-bot:${sha} volleytime-migrator:${sha}$`,
      ),
    )
    expect(calls.join('\n')).not.toContain('never-print-this-secret')
    expect(calls.join('\n')).not.toContain('--build-arg')
    expect(calls.join('\n')).not.toContain('--secret')

    const archive = join(f.output, 'release-images.tar.gz')
    const meta = join(f.output, 'release-images.meta')
    expect(existsSync(archive)).toBe(true)
    const fields = Object.fromEntries(
      readFileSync(meta, 'utf8')
        .trim()
        .split('\n')
        .map((line) => line.split('=', 2)),
    )
    expect(fields).toEqual({
      RELEASE_SHA: sha,
      ARCHIVE_SHA256: createHash('sha256').update(readFileSync(archive)).digest('hex'),
      ARCHIVE_BYTES: String(statSync(archive).size),
      UNPACKED_BYTES: String(gunzipSync(readFileSync(archive)).length),
      WEB_IMAGE: `volleytime-web:${sha}`,
      BOT_IMAGE: `volleytime-bot:${sha}`,
      MIGRATOR_IMAGE: `volleytime-migrator:${sha}`,
    })
    expect(readFileSync(archive).length).toBeGreaterThan(0)
    expect(gunzipSync(readFileSync(archive)).toString()).toBe('fake docker archive\n')
    expect(readFileSync(meta, 'utf8')).not.toContain('never-print-this-secret')
    expect(result.stdout + result.stderr).not.toContain('never-print-this-secret')
    if (process.platform !== 'win32') {
      expect(statSync(archive).mode & 0o777).toBe(0o600)
      expect(statSync(meta).mode & 0o777).toBe(0o600)
    }
  })

  it('refuses to export a migrator image whose bundled CLI fails offline', () => {
    const f = fixture()
    const result = f.run(f.sha, { FAKE_RUN_FAILURE: '1' })

    expect(result.status).not.toBe(0)
    expect(f.commands()).toContain('run --rm --network none --entrypoint node')
    expect(f.commands()).not.toContain('save -o')
    expect(existsSync(join(f.output, 'release-images.tar.gz'))).toBe(false)
    expect(existsSync(join(f.output, 'release-images.meta'))).toBe(false)
  })

  it.each([
    ['architecture', { FAKE_ARCH: 'arm64' }],
    ['revision label', { FAKE_REVISION: 'b'.repeat(40) }],
    ['tag', { FAKE_TAG: `volleytime-web:${'b'.repeat(40)}` }],
  ])('rejects wrong %s before Docker export', (_name, overrides) => {
    const f = fixture()
    const result = f.run(f.sha, overrides)
    expect(result.status).not.toBe(0)
    expect(f.commands()).not.toContain('save -o')
    expect(existsSync(join(f.output, 'release-images.tar.gz'))).toBe(false)
    expect(existsSync(join(f.output, 'release-images.meta'))).toBe(false)
  })

  it('does not publish either artifact when Docker export fails', () => {
    const f = fixture()
    const result = f.run(f.sha, { FAKE_SAVE_FAILURE: '1' })
    expect(result.status).not.toBe(0)
    expect(f.commands()).toContain('save -o')
    expect(existsSync(join(f.output, 'release-images.tar.gz'))).toBe(false)
    expect(existsSync(join(f.output, 'release-images.meta'))).toBe(false)
    expect(readdirSync(f.output)).toEqual([])
  })

  it('rejects a valid SHA different from the checked out commit before Docker build', () => {
    const f = fixture()
    const wrongSha = f.sha === 'b'.repeat(40) ? 'c'.repeat(40) : 'b'.repeat(40)
    const result = f.run(wrongSha)
    expect(result.status).not.toBe(0)
    expect(result.stderr).toContain('checkout SHA does not match release SHA')
    expect(f.commands()).toBe('')
  })

  it('rejects modified tracked source before Docker build', () => {
    const f = fixture()
    writeFileSync(join(f.repo, 'apps', 'web', 'Dockerfile'), 'FROM busybox\n')
    const result = f.run()
    expect(result.status).not.toBe(0)
    expect(result.stderr).toContain('source checkout is not clean')
    expect(f.commands()).toBe('')
  })

  it('rejects untracked source in the build context before Docker build', () => {
    const f = fixture()
    writeFileSync(join(f.repo, 'apps', 'web', 'untracked.ts'), 'export const drift = true\n')
    const result = f.run()
    expect(result.status).not.toBe(0)
    expect(result.stderr).toContain('source checkout is not clean')
    expect(f.commands()).toBe('')
  })

  it('allows ignored build artifacts and scratch without packaging them', () => {
    const f = fixture()
    mkdirSync(join(f.repo, '.output'))
    writeFileSync(join(f.repo, '.output', 'build.js'), 'ignored artifact\n')
    mkdirSync(join(f.repo, '.superpowers', 'sdd'), { recursive: true })
    writeFileSync(join(f.repo, '.superpowers', 'sdd', 'secret.txt'), 'private scratch\n')
    const result = f.run()
    expect(result.status, result.stderr).toBe(0)
    expect(f.commands()).toContain('build --platform linux/amd64')
  })
})

function verifyFixture() {
  const root = mkdtempSync(join(tmpdir(), 'volleytime-verify-images-'))
  dirs.push(root)
  const staging = join(root, 'staging')
  const content = join(root, 'content')
  const bin = join(root, 'bin')
  mkdirSync(staging)
  mkdirSync(content)
  mkdirSync(bin)
  const sha = 'a'.repeat(40)
  const images = ['web', 'bot', 'migrator'].map((name) => `volleytime-${name}:${sha}`)
  const manifest = images.map((image, index) => ({
    Config: `config${index}.json`,
    RepoTags: [image],
    Layers: [`layer${index}/layer.tar`],
  }))
  writeFileSync(join(content, 'manifest.json'), JSON.stringify(manifest))
  images.forEach((_image, index) => {
    writeFileSync(
      join(content, `config${index}.json`),
      JSON.stringify({
        architecture: 'amd64',
        config: { Labels: { 'org.opencontainers.image.revision': sha } },
      }),
    )
    mkdirSync(join(content, `layer${index}`))
    writeFileSync(join(content, `layer${index}`, 'layer.tar'), 'layer')
  })
  const archive = join(staging, 'release-images.tar.gz')
  const makeArchive = () => {
    const result = spawnSync('tar', ['-czf', archive, '-C', content, '.'], { encoding: 'utf8' })
    expect(result.status, result.stderr).toBe(0)
  }
  const makeMeta = (changes: Record<string, string> = {}) => {
    const bytes = readFileSync(archive)
    const fields = {
      RELEASE_SHA: sha,
      ARCHIVE_SHA256: createHash('sha256').update(bytes).digest('hex'),
      ARCHIVE_BYTES: String(bytes.length),
      UNPACKED_BYTES: String(gunzipSync(bytes).length),
      WEB_IMAGE: images[0],
      BOT_IMAGE: images[1],
      MIGRATOR_IMAGE: images[2],
      ...changes,
    }
    writeFileSync(
      join(staging, 'release-images.meta'),
      Object.entries(fields)
        .map(([key, value]) => `${key}=${value}`)
        .join('\n') + '\n',
    )
  }
  makeArchive()
  makeMeta()
  const calls = join(root, 'calls.log')
  writeFileSync(
    join(bin, 'docker'),
    `#!/usr/bin/env bash
printf '%s\\n' "$*" >> "$CALLS"
case "$1 $2" in
  'info --format') printf '%s\\n' "$DOCKER_ROOT" ;;
  'load -i') exit 0 ;;
  'image inspect')
    tag="\${@: -1}"
    printf '%s|%s|%s\\n' "\${FAKE_ARCH:-amd64}" "\${FAKE_REVISION:-$RELEASE_SHA}" "\${FAKE_TAG:-$tag}"
    ;;
esac
`,
  )
  writeFileSync(
    join(bin, 'df'),
    `#!/usr/bin/env bash
printf 'df %s\\n' "\${FAKE_AVAILABLE_KIB:-9999999}" >> "$CALLS"
printf 'Filesystem 1024-blocks Used Available Capacity Mounted on\\n/dev/test 9999999 1 %s 1%% /\\n' "\${FAKE_AVAILABLE_KIB:-9999999}"
`,
  )
  chmodSync(join(bin, 'docker'), 0o755)
  chmodSync(join(bin, 'df'), 0o755)
  const state = join(root, 'live-state')
  writeFileSync(state, 'old release')
  const run = (overrides: Record<string, string> = {}, expectedSha = sha) =>
    spawnSync(bash, [shellPath(verifyScript), shellPath(staging), expectedSha], {
      encoding: 'utf8',
      env: {
        ...process.env,
        PATH: `${shellPath(bin)}:/usr/bin:/mingw64/bin:${process.env.PATH ?? ''}`,
        CALLS: shellPath(calls),
        DOCKER_ROOT: shellPath(root),
        DF_BIN: shellPath(join(bin, 'df')),
        RELEASE_SHA: sha,
        PYTHON_BIN: process.platform === 'win32' ? 'python' : 'python3',
        ...overrides,
      },
    })
  const commands = () => (existsSync(calls) ? readFileSync(calls, 'utf8') : '')
  return {
    root,
    staging,
    content,
    sha,
    images,
    archive,
    state,
    makeArchive,
    makeMeta,
    run,
    commands,
  }
}

describe('staged image bundle verification', () => {
  it('loads a verified archive and inspects all three imported images without touching live state', () => {
    const f = verifyFixture()
    const result = f.run()
    expect(result.status, result.stderr).toBe(0)
    expect(f.commands()).toContain('load -i')
    for (const image of f.images) expect(f.commands()).toContain(` ${image}\n`)
    expect(f.commands().match(/image inspect/g) ?? []).toHaveLength(3)
    expect(f.commands()).not.toMatch(/compose|prune|build|backup/)
    expect(readFileSync(f.state, 'utf8')).toBe('old release')
  })

  it.each([
    [
      'truncated archive',
      (f: ReturnType<typeof verifyFixture>) => {
        const truncated = readFileSync(f.archive).subarray(0, 30)
        writeFileSync(f.archive, truncated)
        const metadata = readFileSync(join(f.staging, 'release-images.meta'), 'utf8')
          .replace(
            /^ARCHIVE_SHA256=.*$/m,
            `ARCHIVE_SHA256=${createHash('sha256').update(truncated).digest('hex')}`,
          )
          .replace(/^ARCHIVE_BYTES=.*$/m, `ARCHIVE_BYTES=${truncated.length}`)
        writeFileSync(join(f.staging, 'release-images.meta'), metadata)
      },
    ],
    [
      'wrong archive hash',
      (f: ReturnType<typeof verifyFixture>) => f.makeMeta({ ARCHIVE_SHA256: 'b'.repeat(64) }),
    ],
    [
      'wrong release SHA',
      (f: ReturnType<typeof verifyFixture>) => f.makeMeta({ RELEASE_SHA: 'b'.repeat(40) }),
    ],
    [
      'wrong metadata tag',
      (f: ReturnType<typeof verifyFixture>) =>
        f.makeMeta({ WEB_IMAGE: `volleytime-web:${'b'.repeat(40)}` }),
    ],
    [
      'wrong archived architecture',
      (f: ReturnType<typeof verifyFixture>) => {
        writeFileSync(
          join(f.content, 'config0.json'),
          JSON.stringify({
            architecture: 'arm64',
            config: { Labels: { 'org.opencontainers.image.revision': f.sha } },
          }),
        )
        f.makeArchive()
        f.makeMeta()
      },
    ],
    [
      'wrong archived revision',
      (f: ReturnType<typeof verifyFixture>) => {
        writeFileSync(
          join(f.content, 'config0.json'),
          JSON.stringify({
            architecture: 'amd64',
            config: { Labels: { 'org.opencontainers.image.revision': 'b'.repeat(40) } },
          }),
        )
        f.makeArchive()
        f.makeMeta()
      },
    ],
    [
      'wrong archived tag',
      (f: ReturnType<typeof verifyFixture>) => {
        const manifest = JSON.parse(
          readFileSync(join(f.content, 'manifest.json'), 'utf8'),
        ) as Array<{ RepoTags: string[] }>
        manifest[0].RepoTags = [`volleytime-web:${'b'.repeat(40)}`]
        writeFileSync(join(f.content, 'manifest.json'), JSON.stringify(manifest))
        f.makeArchive()
        f.makeMeta()
      },
    ],
    [
      'unrecognized metadata key',
      (f: ReturnType<typeof verifyFixture>) =>
        writeFileSync(
          join(f.staging, 'release-images.meta'),
          readFileSync(join(f.staging, 'release-images.meta'), 'utf8') + 'EXTRA=1\n',
        ),
    ],
  ])('rejects %s before docker load', (_name, mutate) => {
    const f = verifyFixture()
    mutate(f)
    const result = f.run()
    expect(result.status, `${result.stdout}\n${result.stderr}\n${f.commands()}`).not.toBe(0)
    expect(f.commands()).not.toContain('load -i')
    expect(f.commands()).not.toMatch(/compose|prune|build|backup/)
    expect(readFileSync(f.state, 'utf8')).toBe('old release')
  })

  it('treats metadata shell syntax as inert data', () => {
    const f = verifyFixture()
    const marker = join(f.root, 'injected')
    const meta = join(f.staging, 'release-images.meta')
    writeFileSync(
      meta,
      readFileSync(meta, 'utf8').replace(
        /^WEB_IMAGE=.*$/m,
        `WEB_IMAGE=$(touch ${shellPath(marker)})`,
      ),
    )
    const result = f.run()
    expect(result.status).not.toBe(0)
    expect(existsSync(marker)).toBe(false)
    expect(f.commands()).not.toContain('load -i')
  })

  it('rejects insufficient disk space before docker load', () => {
    const f = verifyFixture()
    const result = f.run({ FAKE_AVAILABLE_KIB: '1' })
    expect(result.status, `${result.stdout}\n${result.stderr}\n${f.commands()}`).not.toBe(0)
    expect(f.commands()).not.toContain('load -i')
    expect(readFileSync(f.state, 'utf8')).toBe('old release')
  })

  it.each([
    ['architecture', { FAKE_ARCH: 'arm64' }],
    ['revision', { FAKE_REVISION: 'b'.repeat(40) }],
    ['tag', { FAKE_TAG: `volleytime-web:${'b'.repeat(40)}` }],
  ])('rejects loaded %s mismatch without activation', (_name, env) => {
    const f = verifyFixture()
    const result = f.run(env)
    expect(result.status).not.toBe(0)
    expect(f.commands()).toContain('load -i')
    expect(f.commands()).not.toMatch(/compose|prune|build|backup/)
    expect(readFileSync(f.state, 'utf8')).toBe('old release')
  })
})

function activationFixture() {
  const root = mkdtempSync(join(tmpdir(), 'volleytime-activate-images-'))
  dirs.push(root)
  const repo = join(root, 'repo')
  const staging = join(root, 'staging')
  const bin = join(root, 'bin')
  mkdirSync(join(repo, '.deploy', 'scripts'), { recursive: true })
  mkdirSync(staging)
  mkdirSync(bin)
  const git = (...args: string[]) => {
    const result = spawnSync('git', args, { cwd: repo, encoding: 'utf8' })
    expect(result.status, result.stderr).toBe(0)
    return result.stdout.trim()
  }
  git('init', '-b', 'prod')
  git('config', 'user.name', 'Volley Time Test')
  git('config', 'user.email', 'test@volleytime.invalid')
  writeFileSync(join(repo, '.gitignore'), '.deploy/\n.env.images*\n.env\n')
  writeFileSync(join(repo, 'source'), 'old\n')
  writeFileSync(join(repo, 'docker-compose.prod.yml'), 'services: {}\n')
  git('add', '.')
  git('commit', '-m', 'old')
  const old = git('rev-parse', 'HEAD')
  writeFileSync(join(repo, 'source'), 'candidate\n')
  git('commit', '-am', 'candidate')
  const candidate = git('rev-parse', 'HEAD')
  writeFileSync(join(repo, 'source'), 'next\n')
  git('commit', '-am', 'next')
  const next = git('rev-parse', 'HEAD')
  git('bundle', 'create', join(staging, 'release.bundle'), 'prod')
  git('reset', '--hard', candidate)
  const manifest = (sha: string) =>
    `WEB_IMAGE=volleytime-web:${sha}\nBOT_IMAGE=volleytime-bot:${sha}\nMIGRATOR_IMAGE=volleytime-migrator:${sha}\nRELEASE_VERSION=${sha}\n`
  writeFileSync(join(repo, '.env'), 'DB_PASSWORD=old\n')
  writeFileSync(join(staging, '.env.production'), 'DB_PASSWORD=candidate\n')
  writeFileSync(join(repo, 'docker-compose.prod.yml'), 'services: {}\n')
  writeFileSync(join(repo, '.env.images'), manifest(candidate))
  writeFileSync(join(repo, '.env.images.previous'), manifest(old))
  writeFileSync(join(repo, '.deploy', 'previous-git-sha'), `${old}\n`)
  copyFileSync(deployScript, join(repo, '.deploy', 'scripts', 'deploy-image-bundle.sh'))
  const rollbackEnvHelper = fileURLToPath(
    new URL('../../../../scripts/verify-live-rollback-env.sh', import.meta.url),
  )
  if (existsSync(rollbackEnvHelper)) {
    copyFileSync(rollbackEnvHelper, join(repo, '.deploy', 'scripts', 'verify-live-rollback-env.sh'))
  }
  copyFileSync(
    fileURLToPath(new URL('../../../../scripts/compose-images-only.yml', import.meta.url)),
    join(repo, '.deploy', 'scripts', 'compose-images-only.yml'),
  )
  copyFileSync(
    fileURLToPath(new URL('../../../../scripts/release-bundle.sh', import.meta.url)),
    join(repo, '.deploy', 'scripts', 'release-bundle.sh'),
  )
  const calls = join(root, 'calls.log')
  const live = join(root, 'live')
  const partialWeb = join(root, 'partial-web')
  const healthCalls = join(root, 'health-calls')
  writeFileSync(live, old)
  writeFileSync(
    join(bin, 'docker'),
    `#!/usr/bin/env bash
printf '%s\\n' "docker $*" >> "$CALLS"
case "$1 $2" in
  'inspect --format')
    name="\${@: -1}"
    if [ "$3" = '{{json .Config.Env}}' ]; then
      [ "\${FAKE_ENV_JSON:-0}" != 1 ] || { printf 'malformed'; exit 0; }
      printf '["DB_PASSWORD=old","RELEASE_VERSION=%s","PATH=/image-default","SMOKE_TG_ID=old-smoke"]\\n' "$OLD_SHA"
      exit 0
    fi
    case "$name" in
      vt_web|vt_bot) service="\${name#vt_}"; sha="$(cat "$LIVE_SHA")" ;;
      vt_postgres) printf 'true|healthy|postgres:16-alpine\\n'; exit 0 ;;
      *) exit 1 ;;
    esac
    if [ "$service" = web ] && [ -f "$PARTIAL_WEB_SHA" ]; then
      printf 'true|starting|volleytime-web:%s\n' "$(cat "$PARTIAL_WEB_SHA")"
      exit 0
    fi
    if [ "$service" = bot ] && [ -n "\${FAKE_BOT_SHA:-}" ]; then sha="$FAKE_BOT_SHA"; fi
    if [ "$sha" = "$NEXT_SHA" ] && [ -n "\${FAKE_INSPECT_STATUS:-}" ]; then exit "$FAKE_INSPECT_STATUS"; fi
    prefix="volleytime-"
    if [ "$sha" = "$OLD_SHA" ]; then prefix="\${FAKE_OLD_PREFIX:-volleytime-}"; fi
    printf 'true|healthy|%s%s:%s\\n' "$prefix" "$service" "$sha"
    ;;
  'image inspect')
    if [ "\${3:-}" = --format ]; then printf '["PATH=/image-default"]\\n'; exit 0; fi
    if [ "\${FAKE_OLD_PREFIX:-}" != '' ] && [[ "\${@: -1}" == volleytime-*"$OLD_SHA" ]]; then exit 1; fi
    [ "\${FAKE_OLD_IMAGE_MISSING:-0}" != 1 ] || { [[ "\${@: -1}" != *"$OLD_SHA" ]] || exit 1; }
    ;;
  'exec vt_bot')
    if [ "$(cat "$LIVE_SHA")" = "$NEXT_SHA" ] && [ -n "\${FAKE_BOT_HEALTH_STATUS:-}" ]; then exit "$FAKE_BOT_HEALTH_STATUS"; fi
    printf '{"status":"ok","release":"%s"}\\n' "$(cat "$LIVE_SHA")" ;;
  'compose -f')
    if [[ "$*" == *'config --format json'* ]]; then
      cat >/dev/null
      password="$(sed -n 's/^DB_PASSWORD=//p' "$ROOT_PATH/.env")"
      printf '{"services":{"web":{"environment":{"DB_PASSWORD":"%s","RELEASE_VERSION":"%s","SMOKE_TG_ID":"new-smoke"}},"bot":{"environment":{"DB_PASSWORD":"%s","RELEASE_VERSION":"%s","SMOKE_TG_ID":"new-smoke"}}}}\\n' "$password" "$OLD_SHA" "$password" "$OLD_SHA"
      exit 0
    fi
    printf 'compose-env %s\\n' "$(cat "$ROOT_PATH/.env")" >> "$CALLS"
    if [[ "$*" == *'run --rm'* ]]; then
      [[ "$*" != *'--no-build'* ]] || { echo 'unknown flag: --no-build' >&2; exit 16; }
      [ -z "\${FAKE_MIGRATE_STATUS:-}" ] || exit "$FAKE_MIGRATE_STATUS"
      [ "\${FAKE_MIGRATE_FAIL:-0}" != 1 ] || exit 1
    fi
    if [[ "$*" == *'up --no-build -d web bot'* ]]; then
      [ -z "\${FAKE_UP_STATUS:-}" ] || exit "$FAKE_UP_STATUS"
      if [ "\${FAKE_PARTIAL_UP:-0}" = 1 ] && grep -q "$NEXT_SHA" "$ROOT_PATH/.env.images"; then
        printf '%s\n' "$NEXT_SHA" > "$PARTIAL_WEB_SHA"
        exit 1
      fi
      if [ "\${FAKE_UP_FAIL:-0}" = 1 ] && grep -q "$NEXT_SHA" "$ROOT_PATH/.env.images"; then exit 1; fi
      grep '^RELEASE_VERSION=' "$ROOT_PATH/.env.images" | cut -d= -f2 > "$LIVE_SHA"
      rm -f "$PARTIAL_WEB_SHA"
    fi
    ;;
esac
`,
  )
  writeFileSync(
    join(bin, 'curl'),
    `#!/usr/bin/env bash
printf '%s\\n' "curl $*" >> "$CALLS"
sha="$(cat "$LIVE_SHA")"
if [ "$sha" = "$NEXT_SHA" ] && [ -n "\${FAKE_CURL_STATUS:-}" ]; then exit "$FAKE_CURL_STATUS"; fi
if [ "\${FAKE_HEALTH_FAIL:-0}" = 1 ] && [ "$sha" = "$NEXT_SHA" ]; then exit 22; fi
if [ "\${FAKE_HEALTH_TRANSIENT:-0}" = 1 ] && [ "$sha" = "$NEXT_SHA" ]; then
  count=0
  [ ! -f "$HEALTH_CALLS" ] || count="$(cat "$HEALTH_CALLS")"
  count=$((count + 1))
  printf '%s\n' "$count" > "$HEALTH_CALLS"
  [ "$count" -gt 1 ] || exit 22
fi
printf '{"status":"ok","db":"ok","auth":"ok","release":"%s"}\\n' "$sha"
`,
  )
  writeFileSync(join(bin, 'flock'), '#!/usr/bin/env bash\n[ "${FAKE_LOCK_HELD:-0}" != 1 ]\n')
  writeFileSync(
    join(bin, 'install'),
    '#!/usr/bin/env bash\nif [ "$1" = "-d" ]; then mkdir -p "${@: -1}"; else cp "${@: -2:1}" "${@: -1}"; fi\n',
  )
  writeFileSync(
    join(repo, '.deploy', 'scripts', 'verify-release-images.sh'),
    '#!/usr/bin/env bash\nprintf "verify %s\\n" "$*" >> "$CALLS"\n',
  )
  writeFileSync(
    join(repo, '.deploy', 'scripts', 'backup-local.sh'),
    '#!/usr/bin/env bash\nprintf "backup %s\\n" "${LOCAL_BACKUP_KEEP:-}" >> "$CALLS"\n[ "${FAKE_BACKUP_FAIL:-0}" != 1 ]\n',
  )
  chmodSync(join(bin, 'docker'), 0o755)
  chmodSync(join(bin, 'curl'), 0o755)
  chmodSync(join(bin, 'flock'), 0o755)
  chmodSync(join(bin, 'install'), 0o755)
  const env = {
    ...process.env,
    PATH: `${shellPath(bin)}:/usr/bin:/mingw64/bin:${process.env.PATH ?? ''}`,
    VOLLEYTIME_ROOT: shellPath(repo),
    ROOT_PATH: shellPath(repo),
    LIVE_SHA: shellPath(live),
    PARTIAL_WEB_SHA: shellPath(partialWeb),
    HEALTH_CALLS: shellPath(healthCalls),
    CALLS: shellPath(calls),
    OLD_SHA: old,
    NEXT_SHA: next,
    PUBLIC_HEALTH_URL: 'https://test.invalid/api/health',
    CURL_BIN: shellPath(join(bin, 'curl')),
    PYTHON_BIN: process.platform === 'win32' ? 'python' : 'python3',
    HEALTH_ATTEMPTS: '1',
    HEALTH_SLEEP_SECONDS: '0',
  }
  const run = (mode = 'deploy', overrides: Record<string, string> = {}, target = next) =>
    spawnSync(
      bash,
      [
        shellPath(join(repo, '.deploy', 'scripts', 'deploy-image-bundle.sh')),
        mode,
        ...(mode === 'deploy' ? [shellPath(staging), target] : [target]),
      ],
      { encoding: 'utf8', env: { ...env, ...overrides } },
    )
  const commands = () => (existsSync(calls) ? readFileSync(calls, 'utf8') : '')
  return { root, repo, staging, old, candidate, next, git, live, manifest, run, commands }
}

describe('image bundle activation', () => {
  it.each(['changed secret', 'malformed runtime JSON'])(
    'rejects partial rollback env with %s before import, backup or snapshot',
    (failure) => {
      const f = activationFixture()
      if (failure === 'changed secret') {
        writeFileSync(join(f.repo, '.env'), 'DB_PASSWORD=never-print-candidate-secret\n')
      }
      const result = f.run(
        'deploy',
        failure === 'malformed runtime JSON' ? { FAKE_ENV_JSON: '1' } : {},
      )
      expect(result.status).not.toBe(0)
      expect(result.stderr).toContain('rollback env')
      expect(result.stdout + result.stderr).not.toContain('never-print-candidate-secret')
      expect(f.commands()).not.toMatch(/verify |backup |run --rm|up --no-build/)
      expect(existsSync(join(f.repo, '.deploy', `previous-env-${f.next}`))).toBe(false)
      expect(f.git('rev-parse', 'HEAD')).toBe(f.candidate)
    },
    15000,
  )

  it.each(
    ['backed-up', 'rolling-back', 'activated'].flatMap((ghcrPhase) =>
      ['descendant', 'same-SHA'].map((targetKind) => [ghcrPhase, targetKind] as const),
    ),
  )(
    'rejects a %s GHCR checkpoint for A on %s deploy while accepted image X is current',
    (ghcrPhase, targetKind) => {
      const f = activationFixture()
      f.git('reset', '--hard', f.old)
      writeFileSync(join(f.repo, '.env.images'), f.manifest(f.old))
      const phasePath = join(f.repo, '.deploy', 'image-bundle-phase')
      const ghcrPath = join(f.repo, '.deploy', 'ghcr-manual-phase')
      const imagePhase = `smoke-passed ${f.old}\n`
      const ghcrCheckpoint = `${ghcrPhase} ${f.candidate}\n`
      writeFileSync(phasePath, imagePhase)
      writeFileSync(ghcrPath, ghcrCheckpoint)
      const target = targetKind === 'descendant' ? f.next : f.old
      const result = f.run('deploy', {}, target)
      expect(result.status, result.stdout).not.toBe(0)
      expect(result.stderr).toContain('manual recovery checkpoint')
      expect(f.commands()).not.toMatch(/verify |backup |compose /)
      expect(f.git('rev-parse', 'HEAD')).toBe(f.old)
      expect(readFileSync(join(f.repo, '.env.images'), 'utf8')).toBe(f.manifest(f.old))
      expect(readFileSync(f.live, 'utf8')).toBe(f.old)
      expect(readFileSync(phasePath, 'utf8')).toBe(imagePhase)
      expect(readFileSync(ghcrPath, 'utf8')).toBe(ghcrCheckpoint)
    },
    20000,
  )

  it.each(['backed-up', 'rolling-back'])(
    'rejects a %s GHCR checkpoint before import even without an image marker',
    (ghcrPhase) => {
      const f = activationFixture()
      writeFileSync(join(f.repo, '.deploy', 'ghcr-manual-phase'), `${ghcrPhase} ${f.candidate}\n`)
      const result = f.run()
      expect(result.status, result.stdout).not.toBe(0)
      expect(result.stderr).toContain('manual recovery checkpoint')
      expect(f.commands()).not.toMatch(/verify |backup |compose /)
      expect(f.git('rev-parse', 'HEAD')).toBe(f.candidate)
      expect(readFileSync(f.live, 'utf8')).toBe(f.old)
    },
    20000,
  )

  it('accepts image X replay and descendant B with no GHCR checkpoint', () => {
    const f = activationFixture()
    f.git('reset', '--hard', f.old)
    writeFileSync(join(f.repo, '.env.images'), f.manifest(f.old))
    writeFileSync(join(f.repo, '.deploy', 'image-bundle-phase'), `smoke-passed ${f.old}\n`)
    const replay = f.run('deploy', {}, f.old)
    expect(replay.status, replay.stderr).toBe(0)
    expect(f.commands()).not.toMatch(/verify |backup |compose /)
    const deploy = f.run()
    expect(deploy.status, deploy.stderr).toBe(0)
    expect(readFileSync(join(f.repo, '.env.images.previous'), 'utf8')).toBe(f.manifest(f.old))
    expect(f.git('rev-parse', 'HEAD')).toBe(f.next)
    expect(readFileSync(f.live, 'utf8').trim()).toBe(f.next)
  }, 20000)

  it('accepts image B to C after a completed ancestral GHCR handoff A', () => {
    const f = activationFixture()
    writeFileSync(join(f.repo, '.env.images'), f.manifest(f.next))
    writeFileSync(f.live, f.next)
    writeFileSync(join(f.repo, '.deploy', 'image-bundle-phase'), `smoke-passed ${f.next}\n`)
    writeFileSync(join(f.repo, '.deploy', 'ghcr-manual-phase'), `activated ${f.candidate}\n`)
    f.git('reset', '--hard', f.next)
    writeFileSync(join(f.repo, 'source'), 'release C\n')
    f.git('commit', '-am', 'release C')
    const c = f.git('rev-parse', 'HEAD')
    f.git('bundle', 'create', join(f.staging, 'release.bundle'), 'prod')
    f.git('reset', '--hard', f.next)
    const result = f.run('deploy', {}, c)
    expect(result.status, result.stderr).toBe(0)
    expect(f.git('rev-parse', 'HEAD')).toBe(c)
    expect(readFileSync(join(f.repo, '.env.images.previous'), 'utf8')).toBe(f.manifest(f.next))
    expect(readFileSync(f.live, 'utf8').trim()).toBe(c)
  }, 20000)

  it.each([
    'valid',
    'missing-snapshot',
    'wrong-snapshot',
    'wrong-history',
    'wrong-history-manifest',
    'nonancestor',
  ])(
    'validates %s completed GHCR rollback before a new image-bundle release',
    (state) => {
      const f = activationFixture()
      const current = state === 'nonancestor' ? f.candidate : f.old
      const ghcrSha = state === 'nonancestor' ? f.old : f.candidate
      f.git('reset', '--hard', current)
      writeFileSync(f.live, current)
      writeFileSync(join(f.repo, '.env.images'), f.manifest(current))
      writeFileSync(join(f.repo, '.deploy', 'image-bundle-phase'), `smoke-passed ${current}\n`)
      writeFileSync(join(f.repo, '.deploy', 'ghcr-manual-phase'), `rolled-back ${ghcrSha}\n`)
      const snapshot = join(f.repo, '.deploy', `ghcr-old-manifest-${ghcrSha}`)
      const history = join(f.repo, '.deploy', `ghcr-history-${ghcrSha}`)
      if (state !== 'missing-snapshot')
        writeFileSync(snapshot, f.manifest(state === 'wrong-snapshot' ? f.candidate : current))
      mkdirSync(history)
      writeFileSync(
        join(history, '.env.images.previous'),
        f.manifest(state === 'wrong-history-manifest' ? f.candidate : f.old),
      )
      writeFileSync(
        join(history, 'previous-git-sha'),
        `${state === 'wrong-history' ? f.candidate : f.old}\n`,
      )
      const result = f.run()
      if (state !== 'valid') {
        expect(result.status, result.stdout).not.toBe(0)
        expect(result.stderr).toContain('manual recovery checkpoint')
        expect(f.commands()).not.toMatch(/verify |backup |compose /)
        expect(f.git('rev-parse', 'HEAD')).toBe(current)
        expect(readFileSync(f.live, 'utf8')).toBe(current)
        return
      }
      expect(result.status, result.stderr).toBe(0)
      expect(readFileSync(join(f.repo, '.env.images.previous'), 'utf8')).toBe(f.manifest(f.old))
      expect(readFileSync(f.live, 'utf8').trim()).toBe(f.next)
    },
    20000,
  )

  it.each(['valid', 'unfinished-ghcr', 'wrong-ghcr-sha', 'nonancestor-marker', 'stale-target'])(
    'validates %s GHCR handoff after an earlier image-bundle release',
    (state) => {
      const f = activationFixture()
      // X=old was accepted through image-bundle; GHCR then advanced to A=candidate.
      const ghcrManifest = f
        .manifest(f.candidate)
        .replaceAll('volleytime-', 'ghcr.io/owner/volleytime/')
      writeFileSync(join(f.repo, '.env.images'), ghcrManifest)
      writeFileSync(f.live, f.candidate)
      writeFileSync(
        join(f.repo, '.deploy', 'image-bundle-phase'),
        `smoke-passed ${state === 'nonancestor-marker' ? f.next : f.old}\n`,
      )
      writeFileSync(
        join(f.repo, '.deploy', 'ghcr-manual-phase'),
        `${state === 'unfinished-ghcr' ? 'migrating' : 'activated'} ${state === 'wrong-ghcr-sha' ? f.old : f.candidate}\n`,
      )
      const overrides = { OLD_SHA: f.candidate, FAKE_OLD_PREFIX: 'ghcr.io/owner/volleytime/' }
      const result = f.run('deploy', overrides, state === 'stale-target' ? f.old : f.next)
      if (state !== 'valid') {
        expect(result.status).not.toBe(0)
        expect(f.commands()).not.toMatch(/verify |backup |compose /)
        return
      }
      expect(result.status, result.stderr).toBe(0)
      expect(readFileSync(join(f.repo, '.env.images.previous'), 'utf8')).toBe(ghcrManifest)
      const rollback = f.run('rollback', overrides)
      expect(rollback.status, rollback.stderr).toBe(0)
      expect(f.git('rev-parse', 'HEAD')).toBe(f.candidate)
      expect(readFileSync(join(f.repo, '.env.images'), 'utf8')).toBe(ghcrManifest)
      expect(f.commands()).not.toMatch(/ pull | build |prune/)
    },
    20000,
  )

  it('deploys A, confirms smoke, deploys B and rolls back to A', () => {
    const f = activationFixture()
    expect(f.run().status).toBe(0)
    expect(f.run('confirm-smoke').status).toBe(0)
    writeFileSync(join(f.repo, 'source'), 'release B\n')
    f.git('commit', '-am', 'release B')
    const b = f.git('rev-parse', 'HEAD')
    f.git('bundle', 'create', join(f.staging, 'release.bundle'), 'prod')
    f.git('reset', '--hard', f.next)
    const result = f.run('deploy', {}, b)
    expect(result.status, result.stderr).toBe(0)
    expect(readFileSync(join(f.repo, '.env.images.previous'), 'utf8')).toBe(f.manifest(f.next))
    expect(f.run('rollback', {}, b).status).toBe(0)
    expect(f.git('rev-parse', 'HEAD')).toBe(f.next)
  }, 30000)

  it.each(['activated', 'backed-up', 'interrupted', 'smoke-passed'])(
    'rejects a mismatched %s phase before load or backup',
    (phase) => {
      const f = activationFixture()
      writeFileSync(join(f.repo, '.deploy', 'image-bundle-phase'), `${phase} ${f.old}\n`)
      const result = f.run()
      expect(result.status).not.toBe(0)
      expect(f.commands()).not.toMatch(/verify |backup |compose /)
    },
  )

  it.each(
    [124, 137, 143, 255].flatMap((status) =>
      ['MIGRATE', 'UP', 'INSPECT', 'BOT_HEALTH', 'CURL'].map(
        (operation) => [operation, status] as const,
      ),
    ),
  )(
    'preserves interrupted %s status %s without recovery or a second Compose action',
    (operation, status) => {
      const f = activationFixture()
      const result = f.run('deploy', {
        [`FAKE_${operation}_STATUS`]: String(status),
        HEALTH_ATTEMPTS: '3',
      })
      expect(result.status, result.stderr).toBe(status)
      expect(result.stderr).toContain('manual recovery checkpoint')
      expect(f.git('rev-parse', 'HEAD')).toBe(f.next)
      expect(readFileSync(join(f.repo, '.env.images'), 'utf8')).toBe(f.manifest(f.next))
      expect(f.commands().match(/up --no-build -d web bot/g) ?? []).toHaveLength(
        operation === 'MIGRATE' ? 0 : 1,
      )
      expect(readFileSync(join(f.repo, '.deploy', 'image-bundle-phase'), 'utf8')).toContain(
        'interrupted',
      )
      expect(f.run().status).not.toBe(0)
      expect(f.run('rollback').status).not.toBe(0)
    },
    20000,
  )

  it('preserves exact GHCR images through image-bundle activation and rollback without local aliases', () => {
    const f = activationFixture()
    f.git('reset', '--hard', f.old)
    const oldManifest = f.manifest(f.old).replaceAll('volleytime-', 'ghcr.io/owner/volleytime/')
    writeFileSync(join(f.repo, '.env.images'), oldManifest)
    const env = { FAKE_OLD_PREFIX: 'ghcr.io/owner/volleytime/' }
    const result = f.run('deploy', env)
    expect(result.status, result.stderr).toBe(0)
    expect(readFileSync(join(f.repo, '.env.images.previous'), 'utf8')).toBe(oldManifest)
    const rollback = f.run('rollback', env)
    expect(rollback.status, rollback.stderr).toBe(0)
    expect(readFileSync(join(f.repo, '.env.images'), 'utf8')).toBe(oldManifest)
    expect(f.git('rev-parse', 'HEAD')).toBe(f.old)
    expect(f.commands()).not.toMatch(/ pull | build |prune/)
  }, 20000)

  it.each(['wrong-prefix', 'wrong-tag', 'missing-image'])(
    'rejects GHCR %s before importing or backup',
    (failure) => {
      const f = activationFixture()
      f.git('reset', '--hard', f.old)
      let manifest = f.manifest(f.old).replaceAll('volleytime-', 'ghcr.io/owner/volleytime/')
      if (failure === 'wrong-prefix')
        manifest = manifest.replace('ghcr.io/owner/volleytime/web', 'ghcr.io/other/repo/web')
      if (failure === 'wrong-tag') manifest = manifest.replace(`web:${f.old}`, `web:${f.next}`)
      writeFileSync(join(f.repo, '.env.images'), manifest)
      rmSync(join(f.repo, '.env.images.previous'))
      const result = f.run('deploy', {
        FAKE_OLD_PREFIX: 'ghcr.io/owner/volleytime/',
        ...(failure === 'missing-image' ? { FAKE_OLD_IMAGE_MISSING: '1' } : {}),
      })
      expect(result.status).not.toBe(0)
      expect(f.commands()).not.toMatch(/verify |backup |compose /)
    },
  )
  it('uses the staged helper CLI and confirms only after external smoke', () => {
    const deploy = workflow.indexOf('deploy-image-bundle.sh deploy .deploy/incoming/')
    const smoke = workflow.indexOf('node scripts/smoke.mjs')
    const confirm = workflow.indexOf('deploy-image-bundle.sh confirm-smoke ${{ github.sha }}')
    expect(deploy).toBeGreaterThan(-1)
    expect(smoke).toBeGreaterThan(deploy)
    expect(confirm).toBeGreaterThan(smoke)
    expect(workflow).toContain('deploy-image-bundle.sh rollback ${{ github.sha }}')
  })

  // Real Git/Bash fixture setup and activation exceed Vitest's 5s default on Windows.
  it('activates with helpers staged outside the old tracked checkout', () => {
    const f = activationFixture()
    expect(existsSync(join(f.repo, 'scripts', 'verify-release-images.sh'))).toBe(false)
    const result = f.run()
    expect(result.status, result.stderr).toBe(0)
    expect(readFileSync(f.live, 'utf8').trim()).toBe(f.next)
  }, 15000)

  it('preserves live old SHA in the partial state and activates exact new images in order', () => {
    const f = activationFixture()
    const result = f.run()
    expect(result.status, result.stderr).toBe(0)
    expect(readFileSync(join(f.repo, '.deploy', 'previous-git-sha'), 'utf8').trim()).toBe(f.old)
    expect(readFileSync(join(f.repo, '.env.images.previous'), 'utf8')).toBe(f.manifest(f.old))
    expect(readFileSync(join(f.repo, '.env.images'), 'utf8')).toBe(f.manifest(f.next))
    expect(readFileSync(f.live, 'utf8').trim()).toBe(f.next)
    expect(readFileSync(join(f.repo, '.env'), 'utf8')).toBe('DB_PASSWORD=candidate\n')
    const previousEnv = join(f.repo, '.deploy', `previous-env-${f.next}`)
    expect(readFileSync(previousEnv, 'utf8')).toBe('DB_PASSWORD=old\n')
    if (process.platform !== 'win32') expect(statSync(previousEnv).mode & 0o777).toBe(0o600)
    expect(f.git('rev-parse', 'HEAD')).toBe(f.next)
    const calls = f.commands()
    expect(calls.indexOf('config --format json')).toBeGreaterThan(-1)
    expect(calls.indexOf('config --format json')).toBeLessThan(calls.indexOf('verify '))
    expect(calls.indexOf('verify ')).toBeLessThan(calls.indexOf('backup '))
    expect(calls.indexOf('backup ')).toBeLessThan(
      calls.indexOf('run --rm --no-deps --pull never migrate'),
    )
    expect(calls.indexOf('run --rm --no-deps --pull never migrate')).toBeLessThan(
      calls.indexOf('up --no-build -d web bot'),
    )
    expect(calls).not.toMatch(
      /docker (?:build|image prune|system prune|compose .* build\b)|restore/,
    )
    expect(readFileSync(join(f.repo, '.deploy', 'image-bundle-phase'), 'utf8')).toContain(
      `activated ${f.next}`,
    )
  }, 15000)

  it('same-SHA retry retains old previous pointer', () => {
    const f = activationFixture()
    expect(f.run().status).toBe(0)
    expect(f.run('confirm-smoke').status).toBe(0)
    const before = f.commands()
    const retry = f.run()
    expect(retry.status, retry.stderr).toBe(0)
    expect(f.commands().slice(before.length)).not.toMatch(/verify |backup |compose /)
    expect(readFileSync(join(f.repo, '.deploy', 'previous-git-sha'), 'utf8').trim()).toBe(f.old)
  }, 15000)

  it('requires separate exact-SHA confirmation before reporting synthetic smoke success', () => {
    const f = activationFixture()
    expect(f.run().status).toBe(0)
    expect(readFileSync(join(f.repo, '.deploy', 'image-bundle-phase'), 'utf8')).toContain(
      `activated ${f.next}`,
    )
    expect(f.run().status).not.toBe(0)
    const confirm = f.run('confirm-smoke')
    expect(confirm.status, confirm.stderr).toBe(0)
    expect(readFileSync(join(f.repo, '.deploy', 'image-bundle-phase'), 'utf8')).toContain(
      `smoke-passed ${f.next}`,
    )
    expect(f.run().status).toBe(0)
  }, 15000)

  it.each([
    ['live mismatch', { FAKE_BOT_SHA: 'b'.repeat(40) }],
    ['missing old image', { FAKE_OLD_IMAGE_MISSING: '1' }],
  ])('rejects %s before backup', (_name, env) => {
    const f = activationFixture()
    const result = f.run('deploy', env)
    expect(result.status).not.toBe(0)
    expect(f.commands()).not.toContain('verify ')
    expect(f.commands()).not.toContain('backup ')
    expect(f.git('rev-parse', 'HEAD')).toBe(f.candidate)
  })

  it('rejects a live previous SHA missing from Git before loading images or backing up', () => {
    const f = activationFixture()
    const absent = 'a'.repeat(40)
    writeFileSync(f.live, absent)
    writeFileSync(join(f.repo, '.env.images.previous'), f.manifest(absent))
    writeFileSync(join(f.repo, '.deploy', 'previous-git-sha'), `${absent}\n`)
    const result = f.run()
    expect(result.status).not.toBe(0)
    expect(f.commands()).not.toContain('verify ')
    expect(f.commands()).not.toContain('backup ')
  })

  it('rejects dirty checkout before backup', () => {
    const f = activationFixture()
    writeFileSync(join(f.repo, 'source'), 'dirty\n')
    expect(f.run().status).not.toBe(0)
    expect(f.commands()).not.toContain('backup ')
  })

  it('rejects a non fast forward bundle before backup', () => {
    const f = activationFixture()
    writeFileSync(join(f.repo, 'source'), 'diverged\n')
    f.git('commit', '-am', 'diverged')
    const result = f.run()
    expect(result.status).not.toBe(0)
    expect(f.commands()).not.toContain('backup ')
  })

  it('rejects a second lock holder before touching live state', () => {
    const f = activationFixture()
    const result = f.run('deploy', { FAKE_LOCK_HELD: '1' })
    expect(result.status).not.toBe(0)
    expect(f.commands()).toBe('')
  })

  it('backup failure leaves Git and runtime untouched', () => {
    const f = activationFixture()
    const result = f.run('deploy', { FAKE_BACKUP_FAIL: '1' })
    expect(result.status).not.toBe(0)
    expect(f.git('rev-parse', 'HEAD')).toBe(f.candidate)
    expect(readFileSync(f.live, 'utf8')).toBe(f.old)
    expect(readFileSync(join(f.repo, '.env'), 'utf8')).toBe('DB_PASSWORD=old\n')
    expect(existsSync(join(f.repo, '.deploy', `previous-env-${f.next}`))).toBe(false)
  }, 15000)

  it('can retry after a pre-activation backup failure without changing the previous release', () => {
    const f = activationFixture()
    expect(f.run('deploy', { FAKE_BACKUP_FAIL: '1' }).status).not.toBe(0)
    expect(f.git('rev-parse', 'HEAD')).toBe(f.candidate)
    expect(readFileSync(f.live, 'utf8').trim()).toBe(f.old)

    const retry = f.run()
    expect(retry.status, retry.stderr).toBe(0)
    expect(readFileSync(join(f.repo, '.deploy', 'previous-git-sha'), 'utf8').trim()).toBe(f.old)
    expect(readFileSync(f.live, 'utf8').trim()).toBe(f.next)
  }, 30000)

  it('retries the original partial state where checkout and manifest already equal the target', () => {
    const f = activationFixture()
    f.git('reset', '--hard', f.next)
    writeFileSync(join(f.repo, '.env.images'), f.manifest(f.next))
    expect(f.run('deploy', { FAKE_BACKUP_FAIL: '1' }).status).not.toBe(0)
    expect(readFileSync(f.live, 'utf8').trim()).toBe(f.old)
    const retry = f.run()
    expect(retry.status, retry.stderr).toBe(0)
    expect(readFileSync(join(f.repo, '.deploy', 'previous-git-sha'), 'utf8').trim()).toBe(f.old)
    expect(readFileSync(f.live, 'utf8').trim()).toBe(f.next)
  }, 30000)

  it('migration failure never switches web or bot', () => {
    const f = activationFixture()
    const result = f.run('deploy', { FAKE_MIGRATE_FAIL: '1' })
    expect(result.status).not.toBe(0)
    expect(readFileSync(f.live, 'utf8')).toBe(f.old)
    expect(f.commands()).toContain('compose-env DB_PASSWORD=candidate')
    expect(readFileSync(join(f.repo, '.env'), 'utf8')).toBe('DB_PASSWORD=old\n')
    expect(f.commands()).not.toContain('up --no-build -d web bot')
  }, 15000)

  it.each([
    ['up failure', { FAKE_UP_FAIL: '1' }],
    ['smoke failure', { FAKE_HEALTH_FAIL: '1' }],
  ])(
    '%s rolls back with local old images and no build',
    (_name, env) => {
      const f = activationFixture()
      const result = f.run('deploy', env)
      expect(result.status).not.toBe(0)
      expect(f.git('rev-parse', 'HEAD')).toBe(f.old)
      expect(readFileSync(f.live, 'utf8').trim()).toBe(f.old)
      expect(f.commands()).toContain('compose-env DB_PASSWORD=candidate')
      expect(readFileSync(join(f.repo, '.env'), 'utf8')).toBe('DB_PASSWORD=old\n')
      expect(readFileSync(join(f.repo, '.env.images'), 'utf8')).toBe(f.manifest(f.old))
      expect(readFileSync(join(f.repo, '.deploy', 'image-bundle-phase'), 'utf8')).toContain(
        'rolled-back',
      )
      expect(f.commands()).not.toMatch(
        /docker (?:build|image prune|system prune|compose .* build\b)|restore/,
      )
    },
    15000,
  )

  it('restores old images after web starts but bot does not', () => {
    const f = activationFixture()
    const result = f.run('deploy', { FAKE_PARTIAL_UP: '1' })
    expect(result.status).not.toBe(0)
    expect(f.git('rev-parse', 'HEAD')).toBe(f.old)
    expect(readFileSync(f.live, 'utf8').trim()).toBe(f.old)
    expect(readFileSync(join(f.repo, '.env.images'), 'utf8')).toBe(f.manifest(f.old))
    expect(f.commands()).not.toMatch(/docker (?:build|image prune|system prune)/)
  }, 15000)

  it('waits for the new public health to become ready before declaring failure', () => {
    const f = activationFixture()
    const result = f.run('deploy', {
      FAKE_HEALTH_TRANSIENT: '1',
      HEALTH_ATTEMPTS: '3',
      HEALTH_SLEEP_SECONDS: '0',
    })
    expect(result.status, result.stderr).toBe(0)
    expect(readFileSync(f.live, 'utf8').trim()).toBe(f.next)
    expect(f.git('rev-parse', 'HEAD')).toBe(f.next)
  }, 15000)

  it('rolls back an activated candidate by exact SHA', () => {
    const f = activationFixture()
    expect(f.run().status).toBe(0)
    const result = f.run('rollback')
    expect(result.status, result.stderr).toBe(0)
    expect(f.git('rev-parse', 'HEAD')).toBe(f.old)
    expect(readFileSync(f.live, 'utf8').trim()).toBe(f.old)
    expect(readFileSync(join(f.repo, '.env'), 'utf8')).toBe('DB_PASSWORD=old\n')
    expect(readFileSync(join(f.repo, '.env.images'), 'utf8')).toBe(f.manifest(f.old))
  }, 15000)
})
