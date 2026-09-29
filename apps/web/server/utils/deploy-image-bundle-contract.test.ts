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
    expect(calls).toHaveLength(7)
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
    expect(calls[6]).toMatch(
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
