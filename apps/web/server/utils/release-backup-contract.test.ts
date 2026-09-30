import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

const workflowPath = fileURLToPath(
  new URL('../../../../.github/workflows/deploy.yml', import.meta.url),
)
const localBuildScriptPath = fileURLToPath(
  new URL('../../../../scripts/deploy-local-build.sh', import.meta.url),
)
const backupScriptPath = fileURLToPath(
  new URL('../../../../scripts/backup-local.sh', import.meta.url),
)
const imageBundleScriptPath = fileURLToPath(
  new URL('../../../../scripts/deploy-image-bundle.sh', import.meta.url),
)

describe('local release backup contract', () => {
  it('creates a private validated atomic dump with bounded retention', () => {
    const script = readFileSync(backupScriptPath, 'utf8')

    expect(script).toContain('LOCAL_BACKUP_DIR:-/opt/volleytime/backups')
    expect(script).toContain('LOCAL_BACKUP_KEEP:-10')
    expect(script).toContain('umask 077')
    expect(script).toContain('install -d -m 700')
    expect(script).toContain('.partial')
    expect(script).toContain('pg_dump -U volley volleytime')
    expect(script).toContain('gzip -t')
    expect(script).toContain('chmod 600')
    expect(script).toContain('mv --')
    expect(script).toContain('tail -n "+$((KEEP + 1))"')
  })

  it('stops the image-bundle and GHCR paths on backup failure before migration', () => {
    const workflow = readFileSync(workflowPath, 'utf8')
    const localBuild = readFileSync(localBuildScriptPath, 'utf8')
    const imageBundle = readFileSync(imageBundleScriptPath, 'utf8')
    const ghcr = readFileSync(
      new URL('../../../../scripts/deploy-ghcr-manual.sh', import.meta.url),
      'utf8',
    )
    const workflowBackup = ghcr.indexOf('bash "$helper_dir/backup-local.sh"')
    const workflowMigrate = ghcr.indexOf('run --rm migrate')
    const localBackup = localBuild.indexOf('bash .deploy/scripts/backup-local.sh')
    const localAdvance = localBuild.indexOf('release-bundle.sh advance')
    const localMigrate = localBuild.indexOf('run --rm migrate')

    expect(workflow).toContain(
      'install -m 600 scripts/release-bundle.sh scripts/deploy-ghcr-manual.sh scripts/backup-local.sh scripts/verify-ghcr-deploy-state.sh "$stage/scripts/"',
    )
    expect(workflow).toContain(
      'install -m 600 scripts/release-bundle.sh scripts/verify-release-images.sh scripts/verify-live-rollback-env.sh scripts/backup-local.sh scripts/deploy-image-bundle.sh scripts/compose-images-only.yml "$stage/scripts/"',
    )
    expect(workflow).toContain('deploy-image-bundle.sh deploy')
    expect(workflowBackup).toBeGreaterThan(-1)
    expect(workflowMigrate).toBeGreaterThan(workflowBackup)
    expect(localBackup).toBeGreaterThan(-1)
    expect(localAdvance).toBeGreaterThan(localBackup)
    expect(localMigrate).toBeGreaterThan(localBackup)
    const imageBackup = imageBundle.indexOf('bash "$helper_dir/backup-local.sh"')
    const imageAdvance = imageBundle.indexOf('release-bundle.sh" advance')
    const imageMigrate = imageBundle.indexOf('run --rm --no-deps --pull never migrate')
    expect(imageBackup).toBeGreaterThan(imageBundle.indexOf('verify-release-images.sh'))
    expect(imageAdvance).toBeGreaterThan(imageBackup)
    expect(imageMigrate).toBeGreaterThan(imageAdvance)
  })
})
