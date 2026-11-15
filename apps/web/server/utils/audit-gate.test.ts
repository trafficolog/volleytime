import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { afterEach, describe, expect, it } from 'vitest'

// Task 27.2.2 (audit CI-02): the dependency audit gate and its exception file.
const gate = fileURLToPath(new URL('../../../../scripts/audit-gate.mjs', import.meta.url))
const exceptionsFile = fileURLToPath(
  new URL('../../../../.github/audit-exceptions.json', import.meta.url),
)

const dirs: string[] = []
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true })
})

const advisory = (id: string, pkg: string, severity = 'high') => ({
  github_advisory_id: id,
  module_name: pkg,
  severity,
  title: `${pkg} issue`,
})

const runRaw = (
  raw: string,
  exceptionsText = JSON.stringify({ exceptions: [] }),
  today = '2026-11-15',
) => {
  const dir = mkdtempSync(join(tmpdir(), 'volleytime-audit-'))
  dirs.push(dir)
  writeFileSync(join(dir, 'audit.json'), raw)
  writeFileSync(join(dir, 'exceptions.json'), exceptionsText)
  return spawnSync(
    process.execPath,
    [
      gate,
      '--input',
      join(dir, 'audit.json'),
      '--exceptions',
      join(dir, 'exceptions.json'),
      '--today',
      today,
    ],
    { encoding: 'utf8' },
  )
}

const run = (advisories: unknown[], exceptions: Record<string, string>[], today = '2026-11-15') =>
  runRaw(
    JSON.stringify({ advisories: { ...advisories }, metadata: { vulnerabilities: {} } }),
    JSON.stringify({ exceptions }),
    today,
  )

const entry = { ghsa: 'GHSA-aaaa', package: 'foo', reason: 'why', expires: '2026-12-01' }

describe('audit gate', () => {
  it('passes when every high/critical finding has a valid exception', () => {
    expect(run([advisory('GHSA-aaaa', 'foo')], [entry]).status).toBe(0)
  })

  it('fails on a high or critical finding without an exception', () => {
    const result = run([advisory('GHSA-bbbb', 'bar', 'critical')], [entry])
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('GHSA-bbbb')
  })

  it('ignores moderate and low findings', () => {
    expect(run([advisory('GHSA-cccc', 'baz', 'moderate')], []).status).toBe(0)
  })

  it('fails when an exception is expired', () => {
    const result = run([advisory('GHSA-aaaa', 'foo')], [entry], '2026-12-02')
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('expired')
  })

  it('fails when an exception has no reason', () => {
    expect(run([advisory('GHSA-aaaa', 'foo')], [{ ...entry, reason: '' }]).status).toBe(1)
  })
})

describe('audit gate fails closed', () => {
  it.each([
    ['error JSON', JSON.stringify({ error: { code: 'ENOTFOUND', message: 'offline' } })],
    ['empty object', '{}'],
    ['empty stdout', ''],
    ['not JSON', 'npm ERR! network'],
    ['advisories without metadata', JSON.stringify({ advisories: {} })],
    ['metadata without advisories', JSON.stringify({ metadata: {} })],
    ['advisories as array', JSON.stringify({ advisories: [], metadata: {} })],
  ])('exits 2 on %s', (_name, raw) => {
    expect(runRaw(raw).status).toBe(2)
  })

  it('passes a complete report with no findings', () => {
    expect(runRaw(JSON.stringify({ advisories: {}, metadata: {} })).status).toBe(0)
  })

  it('exits 2 on an unreadable exceptions file', () => {
    const raw = JSON.stringify({ advisories: {}, metadata: {} })
    const result = runRaw(raw, '{ not json')
    expect(result.status).toBe(2)
    expect(result.stderr).toContain('exceptions file')
  })

  it('rejects an impossible expiry date', () => {
    const result = run([advisory('GHSA-aaaa', 'foo')], [{ ...entry, expires: '2026-13-45' }])
    expect(result.status).toBe(1)
  })
})

describe('audit exceptions file', () => {
  it('records a reason and a future-dated expiry for every entry', () => {
    const { exceptions } = JSON.parse(readFileSync(exceptionsFile, 'utf8')) as {
      exceptions: Record<string, string>[]
    }
    expect(exceptions.length).toBeGreaterThan(0)
    for (const e of exceptions) {
      expect(e.ghsa).toMatch(/^GHSA-/)
      expect(e.package).toBeTruthy()
      expect(e.reason.length).toBeGreaterThan(10)
      expect(e.expires).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    }
  })
})
