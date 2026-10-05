import { spawnSync } from 'node:child_process'
import {
  copyFileSync,
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

import { afterEach, expect, it } from 'vitest'

const dirs: string[] = []
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true })
})
const bash = process.platform === 'win32' ? 'C:/Program Files/Git/bin/bash.exe' : 'bash'
const pathForShell = (path: string) => path.replaceAll('\\', '/')
const sha = 'a'.repeat(40)

function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'volleytime-runner-images-'))
  dirs.push(root)
  mkdirSync(join(root, 'scripts'))
  const source = fileURLToPath(
    new URL('../../../../scripts/validate-runner-images.sh', import.meta.url),
  )
  if (existsSync(source)) copyFileSync(source, join(root, 'scripts', 'validate-runner-images.sh'))
  for (const name of ['package-release-images', 'verify-release-images']) {
    writeFileSync(
      join(root, 'scripts', `${name}.sh`),
      `#!/usr/bin/env bash\nprintf '%s\\n' '${name}' >> "$CALLS"\n${name.startsWith('package') ? 'mkdir -p "$2"\nprintf "fixture metadata\\n" > "$2/release-images.meta"\n' : ''}exit "\${${name.startsWith('verify') ? 'VERIFY_STATUS' : 'PACKAGE_STATUS'}:-0}"\n`,
    )
  }
  const calls = join(root, 'calls')
  const run = (extra: Record<string, string> = {}) =>
    spawnSync(
      bash,
      [
        '-c',
        `
git() { echo '${sha}'; }
docker() { if [ "$1" = info ]; then echo "$RUNNER_TEMP"; else printf '%s\\n' "docker $*"; fi; }
df() { printf 'Filesystem 1K-blocks Used Available Use%% Mounted on\\n/dev/test 999999999 1 %s 1%% /fake\\n' "$FREE_KIB"; }
free() { echo 'fixture memory capacity'; }
export -f git docker df free
bash "$RUNNER_TEMP/scripts/validate-runner-images.sh" '${sha}'
`,
      ],
      {
        encoding: 'utf8',
        env: {
          ...process.env,
          GITHUB_ACTIONS: 'true',
          RUNNER_OS: 'Linux',
          RUNNER_TEMP: pathForShell(root),
          CALLS: pathForShell(calls),
          FREE_KIB: '99999999',
          ...extra,
        },
      },
    )
  return { run, calls: () => (existsSync(calls) ? readFileSync(calls, 'utf8') : '') }
}

it('refuses insufficient runner capacity before building or importing and reports capacity', () => {
  const f = fixture()
  const result = f.run({ FREE_KIB: '1' })
  expect(result.status).not.toBe(0)
  expect(result.stderr).toContain('Insufficient runner capacity')
  expect(result.stdout).toContain('/dev/test')
  expect(f.calls()).toBe('')
}, 35_000)

it('packages before import and fails closed on verifier failure', () => {
  const f = fixture()
  const result = f.run({ VERIFY_STATUS: '42' })
  expect(result.status, result.stderr).toBe(42)
  expect(f.calls()).toBe('package-release-images\nverify-release-images\n')
}, 35_000)

it('does not import after packaging fails', () => {
  const f = fixture()
  const result = f.run({ PACKAGE_STATUS: '43' })
  expect(result.status, result.stderr).toBe(43)
  expect(f.calls()).toBe('package-release-images\n')
}, 35_000)
