import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

const migratorDockerfile = readFileSync(
  fileURLToPath(new URL('../../../../docker/migrator.Dockerfile', import.meta.url)),
  'utf8',
)
const packageScript = readFileSync(
  fileURLToPath(new URL('../../../../scripts/package-release-images.sh', import.meta.url)),
  'utf8',
)

describe('offline migrator image', () => {
  it('starts the bundled tsx CLI through Node, without runtime pnpm or Corepack', () => {
    expect(migratorDockerfile).toContain(
      'CMD ["node", "./node_modules/tsx/dist/cli.mjs", "src/migrate.ts"]',
    )
    expect(migratorDockerfile).not.toMatch(/^CMD \["pnpm"/m)
  })

  it('probes the final migrator image without networking before export', () => {
    const offlineProbe = packageScript.indexOf('docker run --rm --network none')
    const exportImages = packageScript.indexOf('docker save -o')

    expect(offlineProbe).toBeGreaterThan(-1)
    expect(offlineProbe).toBeLessThan(exportImages)
    expect(packageScript).toContain('"$migrator_image"')
    expect(packageScript).toContain('./node_modules/tsx/dist/cli.mjs --version')
  })
})
