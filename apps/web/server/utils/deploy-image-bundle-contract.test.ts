import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import {
  chmodSync,
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
const bash = process.platform === 'win32' ? 'C:\\Program Files\\Git\\bin\\bash.exe' : 'bash'
const sha = 'a16eb2a2f821e5e8f46fd8749f12d571d7aeadf4'
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
    spawnSync(bash, [shellPath(script), expectedSha, shellPath(output)], {
      env: { ...env, ...overrides },
      encoding: 'utf8',
    })
  const commands = () => (existsSync(calls) ? readFileSync(calls, 'utf8') : '')
  return { output, run, commands }
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
    const result = f.run()
    expect(result.status, result.stderr).toBe(0)
    const calls = f.commands().trim().split('\n')
    expect(calls).toHaveLength(7)
    for (const [name, dockerfile] of [
      ['web', 'apps/web/Dockerfile'],
      ['bot', 'apps/bot/Dockerfile'],
      ['migrator', 'docker/migrator.Dockerfile'],
    ]) {
      expect(calls).toContain(
        `build --platform linux/amd64 --label org.opencontainers.image.revision=${sha} -f ${dockerfile} -t volleytime-${name}:${sha} .`,
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
    const result = f.run(sha, overrides)
    expect(result.status).not.toBe(0)
    expect(f.commands()).not.toContain('save -o')
    expect(existsSync(join(f.output, 'release-images.tar.gz'))).toBe(false)
    expect(existsSync(join(f.output, 'release-images.meta'))).toBe(false)
  })

  it('does not publish either artifact when Docker export fails', () => {
    const f = fixture()
    const result = f.run(sha, { FAKE_SAVE_FAILURE: '1' })
    expect(result.status).not.toBe(0)
    expect(f.commands()).toContain('save -o')
    expect(existsSync(join(f.output, 'release-images.tar.gz'))).toBe(false)
    expect(existsSync(join(f.output, 'release-images.meta'))).toBe(false)
    expect(readdirSync(f.output)).toEqual([])
  })
})
