import { spawnSync } from 'node:child_process'
import { mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { afterEach, describe, expect, it } from 'vitest'

// Task 27.2.1 (audit CI-01): actions pinned by SHA, VPS host key pinned,
// least-privilege GITHUB_TOKEN.
const workflowsDir = fileURLToPath(new URL('../../../../.github/workflows/', import.meta.url))
const configureScript = fileURLToPath(
  new URL('../../../../scripts/configure-vps-ssh.sh', import.meta.url),
)
const runbookPath = fileURLToPath(
  new URL('../../../../docs/operations/runbooks/deploy.md', import.meta.url),
)
const bash = process.platform === 'win32' ? 'C:\\Program Files\\Git\\bin\\bash.exe' : 'bash'
const shellPath = (path: string) =>
  process.platform === 'win32'
    ? path
        .replace(/^([A-Za-z]):\\/, (_match, drive: string) => `/${drive.toLowerCase()}/`)
        .replaceAll('\\', '/')
    : path
const TIMEOUT = 30_000

const workflows = readdirSync(workflowsDir)
  .filter((name) => /\.ya?ml$/.test(name))
  .map((name) => ({
    name,
    text: readFileSync(join(workflowsDir, name), 'utf8').replace(/\r\n/g, '\n'),
  }))

const steps = (workflow: string) => workflow.split(/(?=^ {6}- )/m).slice(1)

const dirs: string[] = []
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true })
})

describe('workflow supply-chain pinning', () => {
  it('finds every workflow', () => {
    expect(workflows.map((w) => w.name).sort()).toEqual([
      'ci.yml',
      'deploy.yml',
      'promote.yml',
      'secret-scan.yml',
      'vps-disk-monitor.yml',
    ])
  })

  it.each(workflows.map((w) => [w.name, w.text] as const))(
    '%s pins every action by full commit SHA with a version comment',
    (_name, text) => {
      const uses = [...text.matchAll(/^\s*(?:- )?uses:\s*(.+)$/gm)].map((m) => m[1]!.trim())
      expect(uses.length).toBeGreaterThan(0)
      for (const ref of uses) {
        expect(ref).toMatch(/^[\w.-]+\/[\w./-]+@[0-9a-f]{40} # v\d+\.\d+\.\d+$/)
      }
    },
  )

  it.each(workflows.map((w) => [w.name, w.text] as const))(
    '%s does not use third-party SSH/SCP actions',
    (_name, text) => {
      expect(text).not.toContain('appleboy/')
      expect(text).not.toMatch(/StrictHostKeyChecking[= ]+(no|accept-new)/i)
      expect(text).not.toContain('ssh-keyscan')
    },
  )
})

describe('workflow token permissions', () => {
  it.each(workflows.map((w) => [w.name, w.text] as const))(
    '%s grants only contents: read at the top level',
    (_name, text) => {
      const top = text.match(/^permissions:\n((?: {2}.*\n)*)/m)
      expect(top, 'top-level permissions').not.toBeNull()
      expect(top![1]).toBe('  contents: read\n')
    },
  )

  it('keeps write scopes only on the jobs that need them', () => {
    const writes = workflows.flatMap(({ name, text }) =>
      [...text.matchAll(/^ {4}permissions:\n((?: {6}.*\n)*)/gm)].flatMap((m) =>
        m[1]!
          .split('\n')
          .filter((line) => line.includes(': write'))
          .map((line) => `${name}:${line.trim()}`),
      ),
    )
    expect(writes.sort()).toEqual([
      'deploy.yml:packages: write',
      'promote.yml:actions: write',
      'promote.yml:contents: write',
    ])
  })
})

describe('VPS SSH host verification', () => {
  const sshWorkflows = workflows.filter((w) => w.text.includes('secrets.VPS_SSH_KEY'))

  it('covers deploy and disk monitor', () => {
    expect(sshWorkflows.map((w) => w.name).sort()).toEqual(['deploy.yml', 'vps-disk-monitor.yml'])
  })

  it.each(sshWorkflows.map((w) => [w.name, w.text] as const))(
    '%s passes the key only to the pinned-host SSH setup and uses only the vps alias',
    (_name, text) => {
      const all = steps(text)
      const configure = all.filter((step) => step.includes('bash scripts/configure-vps-ssh.sh'))
      expect(configure).toHaveLength(1)
      expect(configure[0]).toContain('VPS_KNOWN_HOSTS: ${{ secrets.VPS_KNOWN_HOSTS }}')
      expect(configure[0]).toContain('VPS_HOST: ${{ secrets.VPS_HOST }}')
      expect(configure[0]).toContain('VPS_SSH_KEY: ${{ secrets.VPS_SSH_KEY }}')
      for (const step of all) {
        if (step !== configure[0]) {
          expect(step).not.toMatch(/secrets\.VPS_(SSH_KEY|HOST|KNOWN_HOSTS)/)
        }
      }
      const configureAt = text.indexOf('bash scripts/configure-vps-ssh.sh')
      const remote = all.filter((step) => /\b(ssh|scp)\b -/.test(step))
      expect(remote.length).toBeGreaterThan(0)
      for (const step of remote) {
        expect(text.indexOf(step)).toBeGreaterThan(configureAt)
        const commands = [...step.matchAll(/timeout \d+m (ssh|scp) [^\n]*/g)].map((m) => m[0])
        expect(commands.length, step).toBeGreaterThan(0)
        for (const command of commands) {
          expect(command).toMatch(
            /^timeout \d+m (ssh -n vps "\$REMOTE_SCRIPT"(\)")?|scp -O -r "[^"]+" vps:\/opt\/volleytime\/\.deploy\/incoming)$/,
          )
        }
      }
    },
  )

  const setup = (env: Record<string, string>) => {
    const home = mkdtempSync(join(tmpdir(), 'volleytime-vps-ssh-'))
    dirs.push(home)
    const result = spawnSync(bash, [shellPath(configureScript)], {
      encoding: 'utf8',
      env: { ...process.env, HOME: shellPath(home), ...env },
    })
    return { home, result }
  }

  const hostKey = () => {
    const dir = mkdtempSync(join(tmpdir(), 'volleytime-hostkey-'))
    dirs.push(dir)
    const key = join(dir, 'host')
    const made = spawnSync('ssh-keygen', ['-q', '-t', 'ed25519', '-N', '', '-f', key], {
      encoding: 'utf8',
    })
    expect(made.status, made.stderr).toBe(0)
    return readFileSync(`${key}.pub`, 'utf8').trim().split(' ').slice(0, 2).join(' ')
  }

  const fakeKey = 'not-a-real-private-key-value'

  it(
    'fails closed when the pinned host key is missing or does not cover VPS_HOST',
    () => {
      const missing = setup({ VPS_HOST: 'vps.example', VPS_SSH_KEY: fakeKey, VPS_KNOWN_HOSTS: '' })
      expect(missing.result.status).not.toBe(0)
      expect(missing.result.stderr).toContain('VPS_KNOWN_HOSTS')

      const other = setup({
        VPS_HOST: 'vps.example',
        VPS_SSH_KEY: fakeKey,
        VPS_KNOWN_HOSTS: `other.example ${hostKey()}`,
      })
      expect(other.result.status).not.toBe(0)
      expect(other.result.stderr).toContain('no entry for VPS_HOST')

      const injected = setup({
        VPS_HOST: 'vps.example\nProxyCommand evil',
        VPS_SSH_KEY: fakeKey,
        VPS_KNOWN_HOSTS: `vps.example ${hostKey()}`,
      })
      expect(injected.result.status).not.toBe(0)
      for (const run of [missing, other, injected]) {
        expect(run.result.stdout + run.result.stderr).not.toContain(fakeKey)
      }
    },
    TIMEOUT,
  )

  it(
    'writes a strict client config: pinned known_hosts, no TOFU, batch mode, deploy user',
    () => {
      const { home, result } = setup({
        VPS_HOST: '203.0.113.7',
        VPS_SSH_KEY: fakeKey,
        VPS_KNOWN_HOSTS: `203.0.113.7 ${hostKey()}`,
      })
      expect(result.status, result.stderr).toBe(0)
      expect(result.stdout + result.stderr).not.toContain(fakeKey)
      const sshDir = join(home, '.ssh')
      expect(readFileSync(join(sshDir, 'vps_deploy_key'), 'utf8')).toBe(`${fakeKey}\n`)
      if (process.platform !== 'win32') {
        expect(statSync(join(sshDir, 'vps_deploy_key')).mode & 0o777).toBe(0o600)
        expect(statSync(sshDir).mode & 0o777).toBe(0o700)
      }
      const resolved = spawnSync('ssh', ['-G', '-F', join(sshDir, 'config'), 'vps'], {
        encoding: 'utf8',
      })
      expect(resolved.status, resolved.stderr).toBe(0)
      const config = resolved.stdout.toLowerCase()
      expect(config).toMatch(/^hostname 203\.0\.113\.7$/m)
      expect(config).toMatch(/^user deploy$/m)
      expect(config).toMatch(/^stricthostkeychecking (true|yes)$/m)
      expect(config).toMatch(/^batchmode yes$/m)
      expect(config).toMatch(/^identitiesonly yes$/m)
      expect(config).toMatch(/^userknownhostsfile .*vps_known_hosts$/m)
      expect(config).toMatch(/^globalknownhostsfile \/dev\/null$/m)
      expect(config).toMatch(/^updatehostkeys (false|no)$/m)
      expect(config).toMatch(/^connecttimeout 120$/m)
    },
    TIMEOUT,
  )

  it('documents the owner secret and the wrong-key check', () => {
    const runbook = readFileSync(runbookPath, 'utf8')
    expect(runbook).toContain('VPS_KNOWN_HOSTS')
    expect(runbook).toContain('ssh-keygen -l')
    expect(runbook).toContain('Host key verification failed')
  })
})
