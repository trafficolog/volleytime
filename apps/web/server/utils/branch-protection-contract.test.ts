import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

// Owner decision (27.2.3): gitleaks is a required check on main.
const script = fileURLToPath(
  new URL('../../../../scripts/github/apply-branch-protection.sh', import.meta.url),
)
const secretScan = fileURLToPath(
  new URL('../../../../.github/workflows/secret-scan.yml', import.meta.url),
)
const bash = process.platform === 'win32' ? 'C:\\Program Files\\Git\\bin\\bash.exe' : 'bash'
const shellPath = (path: string) =>
  process.platform === 'win32'
    ? path
        .replace(/^([A-Za-z]):\\/, (_match, drive: string) => `/${drive.toLowerCase()}/`)
        .replaceAll('\\', '/')
    : path

describe('branch protection script', () => {
  it('dry run lists the required checks of main including gitleaks', () => {
    const result = spawnSync(bash, [shellPath(script)], {
      encoding: 'utf8',
      env: { ...process.env, GITHUB_REPOSITORY: 'example/repo' },
    })
    expect(result.status).toBe(0)
    const mainPlan = result.stdout.split('== example/repo prod')[0]!
    const plan = JSON.parse(mainPlan.slice(mainPlan.indexOf('{'))) as {
      required_status_checks: { contexts: string[] }
    }
    expect(plan.required_status_checks.contexts).toEqual([
      'Lint · Format · Typecheck',
      'Test (unit + integration)',
      'Build',
      'Runner image build-export-import',
      'gitleaks (new commits)',
    ])
    expect(result.stdout).toContain('Dry run.')
  })

  it('uses the exact job name of the secret-scan workflow', () => {
    expect(readFileSync(secretScan, 'utf8')).toContain('name: gitleaks (new commits)')
  })
})
