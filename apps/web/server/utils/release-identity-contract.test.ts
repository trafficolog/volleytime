import { spawnSync } from 'node:child_process'
import {
  chmodSync,
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
const compose = readFileSync(rootFile('docker-compose.prod.yml'), 'utf8')
const workflow = readFileSync(rootFile('.github/workflows/deploy.yml'), 'utf8')
const localBuild = readFileSync(rootFile('scripts/deploy-local-build.sh'), 'utf8')
const smoke = readFileSync(rootFile('scripts/smoke.mjs'), 'utf8')
const tempDirs: string[] = []
const bash =
  process.platform === 'win32' && existsSync('C:\\Program Files\\Git\\bin\\bash.exe')
    ? 'C:\\Program Files\\Git\\bin\\bash.exe'
    : 'bash'

const run = (command: string, args: string[], cwd: string, env = process.env) =>
  spawnSync(command, args, { cwd, env, encoding: 'utf8' })

const git = (cwd: string, ...args: string[]) => {
  const result = run('git', args, cwd)
  expect(result.status, result.stderr).toBe(0)
  return result.stdout.trim()
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true })
})

describe('production release identity contract', () => {
  it('passes an explicit full-SHA release identity to web and bot', () => {
    expect(compose.match(/RELEASE_VERSION: \$\{RELEASE_VERSION:-dev\}/g)).toHaveLength(2)
    expect(compose).not.toContain('RELEASE_VERSION: ${WEB_IMAGE:-dev}')
    expect(compose).not.toContain('RELEASE_VERSION: ${BOT_IMAGE:-dev}')
    expect(localBuild).toContain('WEB_IMAGE=volleytime-web:${release_sha}')
    expect(localBuild).toContain('BOT_IMAGE=volleytime-bot:${release_sha}')
    expect(localBuild).toContain('MIGRATOR_IMAGE=volleytime-migrator:${release_sha}')
    expect(localBuild).toContain('RELEASE_VERSION=${release_sha}')
    expect(localBuild).toContain('write_release_manifest "$candidate_manifest" "$expected_sha"')
    expect(workflow).toContain('RELEASE_VERSION=${{ github.sha }}')
  })

  it('preserves the previous manifest before installing a different candidate', () => {
    const compare = localBuild.indexOf('! cmp -s .env.images "$candidate_manifest"')
    const preserve = localBuild.indexOf('cp -f .env.images .env.images.previous')
    const install = localBuild.indexOf('install -m 600 "$candidate_manifest" .env.images')

    expect(compare).toBeGreaterThan(-1)
    expect(preserve).toBeGreaterThan(compare)
    expect(install).toBeGreaterThan(preserve)
    expect(localBuild).toContain('if [ -f .env.images ] && ! cmp -s')
  })

  it('restores Git and image identity before rebuilding a rollback', () => {
    const reset = localBuild.indexOf('git reset --hard "$previous_sha"')
    const restore = localBuild.indexOf('cp -f .env.images.previous .env.images')
    const rebuild = localBuild.indexOf('build web bot', reset)

    expect(localBuild).toContain('test -s .env.images.previous')
    expect(reset).toBeGreaterThan(-1)
    expect(restore).toBeGreaterThan(reset)
    expect(rebuild).toBeGreaterThan(restore)
  })

  it('rolls back to an explicit ancestor with exact identity on a legacy compose revision', () => {
    const dir = mkdtempSync(join(tmpdir(), 'volleytime-explicit-rollback-'))
    tempDirs.push(dir)
    const binDir = join(dir, 'bin')
    mkdirSync(binDir)

    writeFileSync(join(dir, 'deploy-local-build.sh'), localBuild)
    chmodSync(join(dir, 'deploy-local-build.sh'), 0o755)
    writeFileSync(
      join(binDir, 'docker'),
      '#!/usr/bin/env bash\nprintf \'%s\\n\' "$*" >> "$VOLLEYTIME_ROOT/docker.log"\n',
    )
    chmodSync(join(binDir, 'docker'), 0o755)
    writeFileSync(
      join(binDir, 'install'),
      '#!/usr/bin/env bash\nif [ "$1" = "-d" ]; then mkdir -p "${@: -1}"; else cp "${@: -2:1}" "${@: -1}"; fi\n',
    )
    chmodSync(join(binDir, 'install'), 0o755)

    git(dir, 'init', '-b', 'prod')
    git(dir, 'config', 'user.email', 'test@example.com')
    git(dir, 'config', 'user.name', 'Test')
    writeFileSync(
      join(dir, 'docker-compose.prod.yml'),
      'services:\n  web:\n    environment:\n      RELEASE_VERSION: ${WEB_IMAGE:-dev}\n  bot:\n    environment:\n      BOT_MODE: webhook\n      RELEASE_VERSION: ${BOT_IMAGE:-dev}\n',
    )
    writeFileSync(join(dir, 'version.txt'), 'baseline\n')
    git(dir, 'add', 'docker-compose.prod.yml', 'version.txt')
    git(dir, 'commit', '-m', 'baseline')
    const baseline = git(dir, 'rev-parse', 'HEAD')

    writeFileSync(join(dir, 'version.txt'), 'candidate\n')
    git(dir, 'add', 'version.txt')
    git(dir, 'commit', '-m', 'candidate')
    const candidate = git(dir, 'rev-parse', 'HEAD')

    writeFileSync(join(dir, '.env'), 'BOT_MODE=polling\n')
    writeFileSync(
      join(dir, '.env.images'),
      `WEB_IMAGE=volleytime-web:${candidate}\nBOT_IMAGE=volleytime-bot:${candidate}\nMIGRATOR_IMAGE=volleytime-migrator:${candidate}\nRELEASE_VERSION=${candidate}\n`,
    )

    const normalizedRoot = dir.replaceAll('\\', '/')
    const root =
      process.platform === 'win32'
        ? `/${normalizedRoot[0].toLowerCase()}${normalizedRoot.slice(2)}`
        : normalizedRoot
    const shellEnv = Object.fromEntries(
      Object.entries(process.env).filter(([key]) => key.toUpperCase() !== 'PATH'),
    )
    const env = {
      ...shellEnv,
      PATH: `${root}/bin:/usr/bin:/mingw64/bin`,
      VOLLEYTIME_ROOT: root,
    }
    const result = run(
      bash,
      [
        '-c',
        'PATH="$1/bin:$PATH" exec ./deploy-local-build.sh rollback-to "$2"',
        'rollback-test',
        root,
        baseline,
      ],
      dir,
      env,
    )

    expect(result.status, result.stderr).toBe(0)
    expect(git(dir, 'rev-parse', 'HEAD')).toBe(baseline)
    expect(readFileSync(join(dir, '.env.images'), 'utf8')).toBe(
      `WEB_IMAGE=volleytime-web:${baseline}\nBOT_IMAGE=volleytime-bot:${baseline}\nMIGRATOR_IMAGE=volleytime-migrator:${baseline}\nRELEASE_VERSION=${baseline}\n`,
    )
    expect(readFileSync(join(dir, '.deploy', 'rollback-compose.override.yml'), 'utf8')).toContain(
      'RELEASE_VERSION: ${RELEASE_VERSION:-dev}',
    )
    expect(readFileSync(join(dir, '.deploy', 'rollback-compose.override.yml'), 'utf8')).toContain(
      'BOT_MODE: ${BOT_MODE:-webhook}',
    )
    expect(readFileSync(join(dir, 'docker.log'), 'utf8')).toContain(
      '-f .deploy/rollback-compose.override.yml',
    )
  })

  it('rejects unsafe explicit rollback targets before changing Git, manifest or runtime', () => {
    const dir = mkdtempSync(join(tmpdir(), 'volleytime-rejected-rollback-'))
    tempDirs.push(dir)
    const binDir = join(dir, 'bin')
    mkdirSync(binDir)
    writeFileSync(join(dir, 'deploy-local-build.sh'), localBuild)
    chmodSync(join(dir, 'deploy-local-build.sh'), 0o755)
    writeFileSync(
      join(binDir, 'docker'),
      '#!/usr/bin/env bash\nprintf \'%s\\n\' "$*" >> "$VOLLEYTIME_ROOT/docker.log"\n',
    )
    chmodSync(join(binDir, 'docker'), 0o755)
    writeFileSync(
      join(binDir, 'install'),
      '#!/usr/bin/env bash\nif [ "$1" = "-d" ]; then mkdir -p "${@: -1}"; else cp "${@: -2:1}" "${@: -1}"; fi\n',
    )
    chmodSync(join(binDir, 'install'), 0o755)

    git(dir, 'init', '-b', 'prod')
    git(dir, 'config', 'user.email', 'test@example.com')
    git(dir, 'config', 'user.name', 'Test')
    writeFileSync(join(dir, 'docker-compose.prod.yml'), 'services:\n  web: {}\n  bot: {}\n')
    writeFileSync(join(dir, 'version.txt'), 'baseline\n')
    git(dir, 'add', 'docker-compose.prod.yml', 'version.txt')
    git(dir, 'commit', '-m', 'baseline')
    const baseline = git(dir, 'rev-parse', 'HEAD')
    writeFileSync(join(dir, 'version.txt'), 'candidate\n')
    git(dir, 'add', 'version.txt')
    git(dir, 'commit', '-m', 'candidate')
    const candidate = git(dir, 'rev-parse', 'HEAD')
    git(dir, 'switch', '-c', 'divergent', baseline)
    writeFileSync(join(dir, 'version.txt'), 'divergent\n')
    git(dir, 'add', 'version.txt')
    git(dir, 'commit', '-m', 'divergent')
    const divergent = git(dir, 'rev-parse', 'HEAD')
    git(dir, 'switch', 'prod')

    writeFileSync(join(dir, '.env'), 'BOT_MODE=polling\n')
    const manifest = `WEB_IMAGE=volleytime-web:${candidate}\nBOT_IMAGE=volleytime-bot:${candidate}\nMIGRATOR_IMAGE=volleytime-migrator:${candidate}\nRELEASE_VERSION=${candidate}\n`
    writeFileSync(join(dir, '.env.images'), manifest)

    const normalizedRoot = dir.replaceAll('\\', '/')
    const root =
      process.platform === 'win32'
        ? `/${normalizedRoot[0].toLowerCase()}${normalizedRoot.slice(2)}`
        : normalizedRoot
    const shellEnv = Object.fromEntries(
      Object.entries(process.env).filter(([key]) => key.toUpperCase() !== 'PATH'),
    )
    const env = {
      ...shellEnv,
      PATH: `${root}/bin:/usr/bin:/mingw64/bin`,
      VOLLEYTIME_ROOT: root,
    }

    for (const target of ['not-a-sha', '1'.repeat(40), candidate, divergent]) {
      const result = run(
        bash,
        [
          '-c',
          'PATH="$1/bin:$PATH" exec ./deploy-local-build.sh rollback-to "$2"',
          'rollback-test',
          root,
          target,
        ],
        dir,
        env,
      )
      expect(result.status, target).not.toBe(0)
      expect(git(dir, 'rev-parse', 'HEAD')).toBe(candidate)
      expect(readFileSync(join(dir, '.env.images'), 'utf8')).toBe(manifest)
      expect(existsSync(join(dir, 'docker.log'))).toBe(false)
      expect(existsSync(join(dir, '.deploy', 'rollback-compose.override.yml'))).toBe(false)
    }

    writeFileSync(join(dir, 'version.txt'), 'dirty candidate\n')
    const dirtyResult = run(
      bash,
      [
        '-c',
        'PATH="$1/bin:$PATH" exec ./deploy-local-build.sh rollback-to "$2"',
        'rollback-test',
        root,
        baseline,
      ],
      dir,
      env,
    )
    expect(dirtyResult.status).not.toBe(0)
    expect(git(dir, 'rev-parse', 'HEAD')).toBe(candidate)
    expect(readFileSync(join(dir, '.env.images'), 'utf8')).toBe(manifest)
    expect(existsSync(join(dir, 'docker.log'))).toBe(false)
  })

  it('requires the public health response to match the expected release', () => {
    expect(workflow).toContain('EXPECTED_RELEASE: ${{ github.sha }}')
    expect(smoke).toContain('EXPECTED_RELEASE')
    expect(smoke).toContain('healthBody?.release === EXPECTED_RELEASE')
    expect(smoke).toContain('actual=${actualRelease} expected=${EXPECTED_RELEASE}')
  })
})
