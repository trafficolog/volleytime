// Task 27.2.2: gate for `pnpm audit --prod --audit-level=high`.
// Fails on any high/critical advisory that has no valid entry in
// .github/audit-exceptions.json (ghsa, package, reason, expires). Expired entries fail too.
// Usage: node scripts/audit-gate.mjs [--input audit.json] [--exceptions file] [--today YYYY-MM-DD]
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const args = process.argv.slice(2)
const opt = (name) => {
  const i = args.indexOf(name)
  return i >= 0 ? args[i + 1] : undefined
}
const root = fileURLToPath(new URL('..', import.meta.url))
const exceptionsPath = opt('--exceptions') ?? `${root}.github/audit-exceptions.json`
const today = opt('--today') ?? new Date().toISOString().slice(0, 10)

let raw = opt('--input') ? readFileSync(opt('--input'), 'utf8') : undefined
if (raw === undefined) {
  // Exit code 1 only means "vulnerabilities found"; the JSON is still on stdout.
  const run = spawnSync('pnpm', ['audit', '--prod', '--audit-level=high', '--json'], {
    encoding: 'utf8',
    shell: process.platform === 'win32',
    maxBuffer: 64 * 1024 * 1024,
  })
  raw = run.stdout
}
let report
try {
  report = JSON.parse(raw)
} catch {
  console.error('audit-gate: pnpm audit did not return JSON (registry unreachable?)')
  process.exit(2)
}

const exceptions = JSON.parse(readFileSync(exceptionsPath, 'utf8')).exceptions ?? []
const problems = []
for (const e of exceptions) {
  if (!e.ghsa || !e.package || !e.reason || !/^\d{4}-\d{2}-\d{2}$/.test(e.expires ?? '')) {
    problems.push(
      `invalid exception entry (ghsa, package, reason, expires required): ${JSON.stringify(e)}`,
    )
  } else if (e.expires < today) {
    problems.push(`exception expired ${e.expires}: ${e.ghsa} (${e.package})`)
  }
}
const allowed = new Set(exceptions.map((e) => `${e.ghsa}|${e.package}`))
const found = new Set()
for (const adv of Object.values(report.advisories ?? {})) {
  if (adv.severity !== 'high' && adv.severity !== 'critical') continue
  const key = `${adv.github_advisory_id}|${adv.module_name}`
  found.add(key)
  if (!allowed.has(key)) {
    problems.push(`${adv.severity} ${adv.module_name} ${adv.github_advisory_id}: ${adv.title}`)
  }
}
const stale = [...allowed].filter((key) => !found.has(key))
if (stale.length) {
  console.warn(
    `audit-gate: exceptions without a matching finding (remove them): ${stale.join(', ')}`,
  )
}

if (problems.length) {
  console.error(`audit-gate: ${problems.length} problem(s)`)
  for (const p of problems) console.error(`  - ${p}`)
  process.exit(1)
}
console.log(`audit-gate: ok (${found.size} known high/critical advisories covered by exceptions)`)
