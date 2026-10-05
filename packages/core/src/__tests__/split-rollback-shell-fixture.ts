import { spawn, spawnSync } from 'node:child_process'
import { chmodSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { rm } from 'node:fs/promises'
import { createServer } from 'node:http'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

export const splitRollbackScript = fileURLToPath(
  new URL('../../../../scripts/verify-split-rollback.sh', import.meta.url),
)
const bash = process.platform === 'win32' ? 'C:\\Program Files\\Git\\bin\\bash.exe' : 'bash'
const shellPath = (path: string) =>
  process.platform === 'win32'
    ? path
        .replace(/^([A-Za-z]):\\/, (_match, drive: string) => `/${drive.toLowerCase()}/`)
        .replaceAll('\\', '/')
    : path

export async function splitRollbackFixture() {
  const root = mkdtempSync(join(tmpdir(), 'volleytime-split-rollback-'))
  const bin = join(root, 'bin')
  mkdirSync(bin)
  const currentSha = 'b'.repeat(40)
  const oldSha = 'a'.repeat(40)
  const oldImages = [`volleytime-web:${oldSha}`, `volleytime-bot:${oldSha}`]
  const containers = ['web', 'bot', 'web'].map((service, index) => ({
    id: String(index + 1).repeat(64),
    service,
    project: 'volleytime',
    running: true,
    image: `sha256:${service === 'web' ? '4'.repeat(64) : '5'.repeat(64)}`,
    ref: `volleytime-${service}:${currentSha}`,
    revision: currentSha,
    split: '1',
  }))
  const calls: string[][] = []
  let schema = true
  let splitRows = false
  let queryError = false
  let preflightError = false
  let writerAfterQuery = false
  let stopError = false
  let extraHosts: string[] = []
  let ambiguousPostgresAlias = false
  let ambiguousOtherPostgresAlias = false
  const frontendId = 'a'.repeat(64)
  const caddyId = 'f'.repeat(64)
  let ownedAddresses: string[] | undefined
  const networkId = 'd'.repeat(64)
  const pgId = 'e'.repeat(64)
  const containerAddresses = (index: number) =>
    (index === 0 ? ownedAddresses : undefined) ?? [`172.20.0.${index + 3}`, `fd00::${index + 3}`]
  const member = (addresses: string[]) => ({
    IPv4Address: addresses.find((value) => !value.includes(':'))
      ? `${addresses.find((value) => !value.includes(':'))}/16`
      : '',
    IPv6Address: addresses.find((value) => value.includes(':'))
      ? `${addresses.find((value) => value.includes(':'))}/64`
      : '',
  })
  let hook: ((args: string[]) => Promise<string | undefined>) | undefined
  let fixtureEnvironment: Record<string, string> = {}
  let networkTransform: ((value: Record<string, unknown>) => Record<string, unknown>) | undefined
  const handle = async (args: string[]): Promise<[number, string]> => {
    calls.push(args)
    const custom = await hook?.(args)
    if (custom !== undefined) return [0, custom]
    if (args[0] === 'image' && args[1] === 'inspect') {
      if (preflightError) return [1, '']
      const ref = args.at(-1)!
      const c = containers.find((c) => c.image === ref || c.ref === ref)
      const revision = c?.revision ?? oldSha
      return [
        0,
        `${c?.image ?? `sha256:${'9'.repeat(64)}`}|${revision}|${c?.split ?? '<no value>'}`,
      ]
    }
    if (args[0] === 'inspect') {
      if (args[1] !== '--format') {
        const inspected = args.slice(1).map((id) => {
          if (id === caddyId)
            return {
              Id: caddyId,
              Name: '/vt_caddy',
              State: { Running: true },
              NetworkSettings: {
                Networks: {
                  volleytime_frontend: {
                    NetworkID: frontendId,
                    Aliases: [ambiguousOtherPostgresAlias ? 'postgres' : 'caddy'],
                    IPAddress: '172.21.0.9',
                    GlobalIPv6Address: '',
                  },
                },
              },
            }
          const index = containers.findIndex((c) => c.id === id)
          const isPg = id === 'vt_postgres' || id === pgId
          if (!isPg && index < 0) throw new Error('Unknown fake container identity')
          const c = containers[index]
          const addresses = isPg ? ['172.20.0.2', 'fd00::2'] : containerAddresses(index)
          return {
            Id: isPg ? pgId : c!.id,
            State: { Running: isPg || c!.running },
            HostConfig: { NetworkMode: 'volleytime_backend', ExtraHosts: isPg ? [] : extraHosts },
            Config: {
              Labels: {
                'com.docker.compose.project': 'volleytime',
                'com.docker.compose.service': isPg ? 'postgres' : c!.service,
              },
              Env: ['DATABASE_URL=postgres://volley:test@postgres:5432/volleytime'],
            },
            NetworkSettings: {
              Ports: {},
              Networks: {
                ...(!isPg
                  ? {
                      volleytime_frontend: {
                        NetworkID: frontendId,
                        Aliases: [ambiguousPostgresAlias ? 'postgres' : c!.service],
                        IPAddress: `172.21.0.${index + 3}`,
                        GlobalIPv6Address: '',
                      },
                    }
                  : {}),
                volleytime_backend: {
                  NetworkID: networkId,
                  Aliases: [isPg ? 'postgres' : c!.service],
                  IPAddress: addresses.find((value) => !value.includes(':')) ?? '',
                  GlobalIPv6Address: addresses.find((value) => value.includes(':')) ?? '',
                },
              },
            },
          }
        })
        return [0, JSON.stringify(inspected)]
      }
      const c = containers.find((c) => c.id === args.at(-1) || `vt_${c.service}` === args.at(-1))
      if (!c) return [1, '']
      if (args[2]?.includes('.State.Running'))
        return [0, `${c.running}|${c.image}|${c.ref}|${c.project}|${c.service}`]
      return [0, c.project]
    }
    if (args[0] === 'network' && args[1] === 'inspect') {
      const value = {
        Id: networkId,
        Driver: 'bridge',
        Scope: 'local',
        Containers: {
          [pgId]: member(['172.20.0.2', 'fd00::2']),
          ...Object.fromEntries(
            containers.map((c, index) => [c.id, member(containerAddresses(index))]),
          ),
        },
      }
      const frontend = {
        Id: frontendId,
        Driver: 'bridge',
        Scope: 'local',
        Containers: {
          [caddyId]: member(['172.21.0.9']),
          ...Object.fromEntries(
            containers.map((c, index) => [c.id, member([`172.21.0.${index + 3}`])]),
          ),
        },
      }
      return [
        0,
        JSON.stringify(
          args
            .slice(2)
            .map((id) => (id === frontendId ? frontend : (networkTransform?.(value) ?? value))),
        ),
      ]
    }
    if (args[0] === 'ps') {
      const service = args
        .find((a) => a.startsWith('label=com.docker.compose.service='))
        ?.split('=')
        .at(-1)
      return [
        0,
        containers
          .filter((c) => c.service === service && (args.includes('-a') || c.running))
          .map((c) => c.id)
          .join('\n'),
      ]
    }
    if (args[0] === 'stop') {
      for (const c of containers) if (args.includes(c.id)) c.running = false
      return [stopError ? 1 : 0, '']
    }
    if (args[0] === 'start') {
      for (const c of containers) if (args.includes(c.id)) c.running = true
      return [0, '']
    }
    if (args[0] === 'compose' && args.includes('psql')) {
      if (args.at(-1)?.includes('pg_stat_activity')) return [0, 't']
      if (queryError && containers.every((c) => !c.running)) return [1, '']
      if (args.at(-1)?.includes('information_schema')) return [0, schema ? 't' : 'f']
      if (writerAfterQuery && containers.every((c) => !c.running)) containers[2]!.running = true
      return [0, splitRows ? 't' : 'f']
    }
    return [90, `Unexpected fake Docker call: ${args.join(' ')}`]
  }
  const server = createServer(async (request, response) => {
    let body = ''
    for await (const part of request) body += part.toString()
    try {
      const [code, output] = await handle(body.trimEnd().split('\n'))
      response.end(`${code}\n${output}`)
    } catch (error) {
      response.end(`91\n${String(error)}`)
    }
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('Missing fixture address')
  writeFileSync(
    join(bin, 'docker'),
    `#!/usr/bin/env bash
result="$(printf '%s\\n' "$@" | curl --fail --silent --show-error --data-binary @- "$DOCKER_FIXTURE_URL")" || exit 92
code="\${result%%$'\\n'*}"
if [[ "$result" == *$'\\n'* ]]; then printf '%s' "\${result#*$'\\n'}"; fi
exit "$code"
`,
  )
  chmodSync(join(bin, 'docker'), 0o755)
  writeFileSync(join(root, 'docker-compose.prod.yml'), 'services: {}\n')
  writeFileSync(join(root, '.env'), 'fixture\n')
  writeFileSync(join(root, '.env.images'), 'fixture\n')
  const snapshot = join(root, 'captured-runtime')
  const active = new Set<{ stop: (reason: string) => void; closed: Promise<void> }>()
  let closing = false
  const run = (mode?: 'recheck' | 'recover', timeoutMs = 30_000) =>
    new Promise<{ status: number | null; stdout: string; stderr: string }>((resolve, reject) => {
      if (closing) {
        reject(new Error('Rollback fixture closed'))
        return
      }
      const child = spawn(
        bash,
        [
          '-c',
          'PATH="$1:$PATH"; shift; exec 9>fixture-deploy.lock; exec bash "$@"',
          'fixture',
          shellPath(bin),
          shellPath(splitRollbackScript),
          ...(mode ? [mode] : oldImages),
          shellPath(snapshot),
        ],
        {
          cwd: root,
          detached: process.platform !== 'win32',
          env: {
            ...process.env,
            ...fixtureEnvironment,
            DOCKER_FIXTURE_URL: `http://127.0.0.1:${address.port}`,
            VOLLEYTIME_ROOT: shellPath(root),
            PYTHON_BIN: process.platform === 'win32' ? 'python' : 'python3',
          },
        },
      )
      let stdout = ''
      let stderr = ''
      let stopped: string | null = null
      let joined!: () => void
      const owned = {
        closed: new Promise<void>((resolve) => {
          joined = resolve
        }),
        stop(reason: string) {
          if (stopped !== null) return
          stopped = reason
          if (!child.pid) return
          if (process.platform === 'win32') {
            // Exact owned PID and descendants only; never a process-name/global kill.
            const killed = spawnSync('taskkill.exe', ['/PID', String(child.pid), '/T', '/F'], {
              timeout: 5000,
              windowsHide: true,
              encoding: 'utf8',
            })
            if (killed.error) stderr += `Owned tree termination failed: ${killed.error.message}\n`
          } else {
            try {
              process.kill(-child.pid, 'SIGKILL')
            } catch {
              /* The owned group already exited. */
            }
          }
          // Windows pipe handles can outlive taskkill's successful tree exit.
          child.stdin.destroy()
          child.stdout.destroy()
          child.stderr.destroy()
        },
      }
      active.add(owned)
      const timer = setTimeout(
        () => owned.stop(`Rollback subprocess timed out after ${timeoutMs}ms`),
        timeoutMs,
      )
      const finish = () => {
        clearTimeout(timer)
        active.delete(owned)
        joined()
      }
      child.stdout.on('data', (part) => (stdout += String(part)))
      child.stderr.on('data', (part) => (stderr += String(part)))
      child.on('error', (error) => {
        finish()
        reject(error)
      })
      child.on('close', (status) => {
        finish()
        if (stopped !== null) reject(new Error(stopped))
        else resolve({ status, stdout, stderr })
      })
    })
  return {
    root,
    snapshot,
    calls,
    containers,
    currentSha,
    oldSha,
    run,
    set options(value: {
      schema?: boolean
      splitRows?: boolean
      queryError?: boolean
      preflightError?: boolean
      writerAfterQuery?: boolean
      stopError?: boolean
      extraHosts?: string[]
      ambiguousPostgresAlias?: boolean
      ambiguousOtherPostgresAlias?: boolean
    }) {
      schema = value.schema ?? schema
      splitRows = value.splitRows ?? splitRows
      queryError = value.queryError ?? queryError
      preflightError = value.preflightError ?? preflightError
      writerAfterQuery = value.writerAfterQuery ?? writerAfterQuery
      stopError = value.stopError ?? stopError
      extraHosts = value.extraHosts ?? extraHosts
      ambiguousPostgresAlias = value.ambiguousPostgresAlias ?? ambiguousPostgresAlias
      ambiguousOtherPostgresAlias = value.ambiguousOtherPostgresAlias ?? ambiguousOtherPostgresAlias
    },
    set hook(value: (args: string[]) => Promise<string | undefined>) {
      hook = value
    },
    set addresses(value: string[]) {
      ownedAddresses = value
    },
    set environment(value: Record<string, string>) {
      fixtureEnvironment = value
    },
    set network(value: (value: Record<string, unknown>) => Record<string, unknown>) {
      networkTransform = value
    },
    async close() {
      closing = true
      for (const owned of active) owned.stop('Rollback fixture closed')
      await Promise.all(Array.from(active, (owned) => owned.closed))
      server.closeAllConnections()
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      )
      // Bounded filesystem cleanup after owned Windows process handles are released.
      await rm(root, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 })
    },
  }
}
