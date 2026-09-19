import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

const rootFile = (path: string) => fileURLToPath(new URL(`../../../../${path}`, import.meta.url))
const compose = readFileSync(rootFile('docker-compose.prod.yml'), 'utf8')
const workflow = readFileSync(rootFile('.github/workflows/deploy.yml'), 'utf8')
const localBuild = readFileSync(rootFile('scripts/deploy-local-build.sh'), 'utf8')
const smoke = readFileSync(rootFile('scripts/smoke.mjs'), 'utf8')

describe('production release identity contract', () => {
  it('passes an explicit full-SHA release identity to web and bot', () => {
    expect(compose.match(/RELEASE_VERSION: \$\{RELEASE_VERSION:-dev\}/g)).toHaveLength(2)
    expect(compose).not.toContain('RELEASE_VERSION: ${WEB_IMAGE:-dev}')
    expect(compose).not.toContain('RELEASE_VERSION: ${BOT_IMAGE:-dev}')
    expect(localBuild).toContain('WEB_IMAGE=volleytime-web:${expected_sha}')
    expect(localBuild).toContain('BOT_IMAGE=volleytime-bot:${expected_sha}')
    expect(localBuild).toContain('MIGRATOR_IMAGE=volleytime-migrator:${expected_sha}')
    expect(localBuild).toContain('RELEASE_VERSION=${expected_sha}')
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

  it('requires the public health response to match the expected release', () => {
    expect(workflow).toContain('EXPECTED_RELEASE: ${{ github.sha }}')
    expect(smoke).toContain('EXPECTED_RELEASE')
    expect(smoke).toContain('healthBody?.release === EXPECTED_RELEASE')
    expect(smoke).toContain('actual=${actualRelease} expected=${EXPECTED_RELEASE}')
  })
})
