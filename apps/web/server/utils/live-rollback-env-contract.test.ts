import { spawnSync } from 'node:child_process'
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { afterEach, describe, expect, it } from 'vitest'

const bash = process.platform === 'win32' ? 'C:\\Program Files\\Git\\bin\\bash.exe' : 'bash'
const helper = fileURLToPath(
  new URL('../../../../scripts/verify-live-rollback-env.sh', import.meta.url),
)
const shellPath = (path: string) =>
  process.platform === 'win32'
    ? path
        .replace(/^([A-Za-z]):\\/, (_match, drive: string) => `/${drive.toLowerCase()}/`)
        .replaceAll('\\', '/')
    : path
const dirs: string[] = []
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true })
})

function fixture(failure = '') {
  const root = mkdtempSync(join(tmpdir(), 'volleytime-rollback-env-'))
  dirs.push(root)
  const bin = join(root, 'bin')
  mkdirSync(bin)
  const sha = 'a'.repeat(40)
  writeFileSync(join(root, '.env'), 'SECRET=rendered-secret\n')
  writeFileSync(
    join(root, 'previous'),
    `WEB_IMAGE=volleytime-web:${sha}\nBOT_IMAGE=volleytime-bot:${sha}\nMIGRATOR_IMAGE=volleytime-migrator:${sha}\nRELEASE_VERSION=${sha}\n`,
  )
  const image = ['PATH=/old-image', 'NODE_VERSION=22', 'OVERRIDE=image-default']
  const configured: Record<string, string> = {
    SECRET: 'live-secret',
    OVERRIDE: 'compose=value',
    SMOKE_TG_ID: 'new-smoke',
  }
  if (failure === 'changed secret') configured.SECRET = 'rendered-secret'
  if (failure === 'missing runtime key') configured.EXTRA = 'rendered-secret'
  const runtime = [
    'PATH=/old-image',
    'NODE_VERSION=22',
    'SECRET=live-secret',
    'OVERRIDE=compose=value',
    'SMOKE_TG_ID=old-smoke',
  ]
  if (failure === 'extra runtime key') runtime.push('EXTRA=live-secret')
  if (failure === 'changed image default') image[0] = 'PATH=/wrong-image'
  if (failure === 'duplicate runtime key') runtime.push('SECRET=other-secret')
  if (failure === 'invalid runtime entry') runtime.push('malformed')
  if (failure === 'null Compose value') (configured as Record<string, unknown>).SECRET = null
  writeFileSync(
    join(root, 'compose.json'),
    failure === 'malformed Compose JSON'
      ? 'bad rendered-secret'
      : JSON.stringify({
          services: { web: { environment: configured }, bot: { environment: configured } },
        }),
  )
  writeFileSync(
    join(root, 'image.json'),
    failure === 'malformed image JSON' ? '{}' : JSON.stringify(image),
  )
  writeFileSync(
    join(root, 'runtime.json'),
    failure === 'malformed runtime JSON' ? 'bad live-secret' : JSON.stringify(runtime),
  )
  const calls = join(root, 'calls')
  writeFileSync(
    join(bin, 'git'),
    '#!/usr/bin/env bash\nprintf "git %s\\n" "$*" >> "$CALLS"\n[ "$FAILURE" != "missing old Compose" ] || exit 1\nprintf "services: old-compose\\n"\n',
  )
  writeFileSync(
    join(bin, 'docker'),
    `#!/usr/bin/env bash
printf 'docker %s\\n' "$*" >> "$CALLS"
case "$1 $2" in
  'compose -f')
    [ "$FAILURE" != 'Compose failure' ] || { echo 'rendered-secret' >&2; exit 1; }
    input="$(cat)"
    [ "$input" = 'services: old-compose' ] || exit 1
    cat "$FIXTURE/compose.json" ;;
  'image inspect')
    [ "$FAILURE" != 'image inspect failure' ] || { echo 'live-secret' >&2; exit 1; }
    cat "$FIXTURE/image.json" ;;
  'inspect --format')
    [ "$FAILURE" != 'runtime inspect failure' ] || { echo 'live-secret' >&2; exit 1; }
    cat "$FIXTURE/runtime.json" ;;
  *) exit 1 ;;
esac
`,
  )
  for (const name of ['git', 'docker']) chmodSync(join(bin, name), 0o755)
  const run = () =>
    spawnSync(
      bash,
      [
        '-c',
        'PATH="$1:$PATH"; shift; exec bash "$@"',
        'fixture',
        shellPath(bin),
        shellPath(helper),
        'previous',
      ],
      {
        cwd: root,
        encoding: 'utf8',
        env: {
          ...process.env,
          VOLLEYTIME_ROOT: shellPath(root),
          FIXTURE: shellPath(root),
          CALLS: shellPath(calls),
          FAILURE: failure,
          PYTHON_BIN: process.platform === 'win32' ? 'python' : 'python3',
        },
      },
    )
  return { run, calls: () => readFileSync(calls, 'utf8'), sha }
}

describe('live rollback environment proof', () => {
  it('renders old Compose and merges old image defaults, permitting only smoke ID drift', () => {
    const f = fixture()
    const result = f.run()
    expect(result.status, result.stderr).toBe(0)
    expect(f.calls()).toContain(`git show ${f.sha}:docker-compose.prod.yml`)
    expect(f.calls()).toContain('--env-file .env --env-file previous config --format json')
    expect(f.calls()).toContain(`volleytime-web:${f.sha}`)
    expect(f.calls()).toContain(`volleytime-bot:${f.sha}`)
    expect(result.stdout + result.stderr).not.toMatch(
      /live-secret|rendered-secret|old-smoke|new-smoke/,
    )
  }, 35_000)

  it.each([
    'changed secret',
    'missing runtime key',
    'extra runtime key',
    'changed image default',
    'duplicate runtime key',
    'invalid runtime entry',
    'null Compose value',
    'malformed Compose JSON',
    'malformed image JSON',
    'malformed runtime JSON',
    'missing old Compose',
    'Compose failure',
    'image inspect failure',
    'runtime inspect failure',
  ])(
    'fails closed on %s without logging values',
    (failure) => {
      const result = fixture(failure).run()
      expect(result.status).not.toBe(0)
      expect(result.stderr).toContain('rollback env')
      expect(result.stdout + result.stderr).not.toMatch(
        /live-secret|rendered-secret|other-secret|old-smoke|new-smoke/,
      )
    },
    35_000,
  )
})
