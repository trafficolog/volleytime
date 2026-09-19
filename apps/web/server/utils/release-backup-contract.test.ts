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

  it('stops both deploy paths on a backup failure before migration', () => {
    const workflow = readFileSync(workflowPath, 'utf8')
    const localBuild = readFileSync(localBuildScriptPath, 'utf8')
    const workflowBackup = workflow.indexOf('bash .deploy/scripts/backup-local.sh')
    const workflowMigrate = workflow.indexOf('run --rm migrate')
    const localBackup = localBuild.indexOf('bash .deploy/scripts/backup-local.sh')
    const localAdvance = localBuild.indexOf('release-bundle.sh advance')
    const localMigrate = localBuild.indexOf('run --rm migrate')

    expect(workflow).toContain(
      "source: '.env.production,release.bundle,scripts/release-bundle.sh,scripts/deploy-local-build.sh,scripts/backup-local.sh'",
    )
    expect(workflowBackup).toBeGreaterThan(-1)
    expect(workflowMigrate).toBeGreaterThan(workflowBackup)
    expect(localBackup).toBeGreaterThan(-1)
    expect(localAdvance).toBeGreaterThan(localBackup)
    expect(localMigrate).toBeGreaterThan(localBackup)
  })
})
