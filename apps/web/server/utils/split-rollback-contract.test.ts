import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { splitRollbackFixture } from '../../../../packages/core/src/__tests__/split-rollback-shell-fixture'

describe('split rollback boundary (fake Docker shell evidence)', { timeout: 35_000 }, () => {
  it('retry recovery still drains additional writers stopped by an earlier failed recovery', async () => {
    const f = await splitRollbackFixture()
    try {
      expect((await f.run()).status).toBe(0)
      const additional = { ...f.containers[0]!, id: '6'.repeat(64), running: true }
      f.containers.push(additional)
      f.hook = async (args) => {
        if (
          args.at(-1)?.includes('SELECT NOT EXISTS') &&
          args.at(-1)?.includes("'172.20.0.6'::inet")
        )
          return 'f'
      }
      expect((await f.run('recover')).status).toBe(1)
      expect(f.containers.every((c) => !c.running)).toBe(true)
      f.hook = async () => undefined
      const boundary = f.calls.length
      const retried = await f.run('recover')
      expect(retried.status, retried.stderr).toBe(0)
      const calls = f.calls.slice(boundary)
      const drain = calls.findIndex(
        (args) =>
          args.at(-1)?.includes('pg_terminate_backend') &&
          args.at(-1)?.includes("'172.20.0.6'::inet"),
      )
      expect(
        drain,
        'retry must retain stopped additional writer backend ownership',
      ).toBeGreaterThanOrEqual(0)
      expect(calls.findIndex((args) => args[0] === 'start')).toBeGreaterThan(drain)
      expect(additional.running).toBe(false)
    } finally {
      await f.close()
    }
  })
  it('Python optimization cannot bypass topology safety checks', async () => {
    const f = await splitRollbackFixture()
    try {
      f.environment = { PYTHONOPTIMIZE: '1' }
      f.network = (value) => ({ ...value, Driver: 'host' })
      const result = await f.run()
      expect(result.status).toBe(1)
      expect(f.calls.some((args) => args[0] === 'stop')).toBe(false)
    } finally {
      await f.close()
    }
  })
  it('drains every owned IPv4/IPv6 address after stop and again before switch', async () => {
    const f = await splitRollbackFixture()
    try {
      const result = await f.run()
      expect(result.status, result.stderr).toBe(0)
      const stop = f.calls.findIndex((args) => args[0] === 'stop')
      const drains = f.calls
        .map((args, index) => ({ query: args.at(-1)!, index }))
        .filter(({ query }) => query.includes('pg_terminate_backend'))
      expect(drains).toHaveLength(2)
      for (const { query, index } of drains) {
        expect(index).toBeGreaterThan(stop)
        expect(query).toContain('pg_terminate_backend(pid,10000)')
        expect(query).toContain("statement_timeout='30s'")
        for (const address of [
          '172.20.0.3',
          '172.20.0.4',
          '172.20.0.5',
          'fd00::3',
          'fd00::4',
          'fd00::5',
        ])
          expect(query).toContain(`'${address}'::inet`)
      }
      const schemaAfterStop = f.calls.findIndex(
        (args, index) => index > stop && args.at(-1)?.includes('information_schema'),
      )
      expect(schemaAfterStop).toBeGreaterThan(drains[0]!.index)
      expect((await f.run('recheck')).status).toBe(0)
      expect(f.calls.at(-1)!.at(-1)).toContain('SELECT NOT EXISTS')
    } finally {
      await f.close()
    }
  })
  it.each(['host-network', 'published-db', 'wrong-db-url', 'shared-address'] as const)(
    'unproven ownership fails before stopping: %s',
    async (failure) => {
      const f = await splitRollbackFixture()
      try {
        f.hook = async (args) => {
          if (args[0] === 'inspect' && args[1] !== '--format') {
            // Feed only malformed topology; no fixture or production secret can appear in output.
            const pg = {
              Id: 'e'.repeat(64),
              State: { Running: true },
              Config: {
                Labels: {
                  'com.docker.compose.project': 'volleytime',
                  'com.docker.compose.service': 'postgres',
                },
              },
              HostConfig: { NetworkMode: failure === 'host-network' ? 'host' : 'bridge' },
              NetworkSettings: {
                Ports: failure === 'published-db' ? { '5432/tcp': [{ HostPort: '5432' }] } : {},
                Networks: {
                  backend: {
                    NetworkID: 'd'.repeat(64),
                    Aliases: ['postgres'],
                    IPAddress: '172.20.0.2',
                    GlobalIPv6Address: 'fd00::2',
                  },
                },
              },
            }
            return JSON.stringify([
              pg,
              ...f.containers.map((c) => ({
                Id: c.id,
                State: { Running: true },
                HostConfig: { NetworkMode: 'bridge' },
                Config: {
                  Labels: {
                    'com.docker.compose.project': c.project,
                    'com.docker.compose.service': c.service,
                  },
                  Env: [
                    `DATABASE_URL=postgres://volley:DO_NOT_PRINT@${failure === 'wrong-db-url' ? 'localhost' : 'postgres'}:5432/volleytime`,
                  ],
                },
                NetworkSettings: {
                  Networks: {
                    backend: {
                      NetworkID: 'd'.repeat(64),
                      IPAddress: '172.20.0.3',
                      GlobalIPv6Address: 'fd00::3',
                    },
                  },
                },
              })),
            ])
          }
        }
        const result = await f.run()
        expect(result.status).toBe(1)
        expect(result.stderr).toContain('ownership')
        expect(result.stderr).not.toContain('DO_NOT_PRINT')
        expect(f.calls.some((args) => args[0] === 'stop')).toBe(false)
        expect(f.containers.every((c) => c.running)).toBe(true)
      } finally {
        await f.close()
      }
    },
  )
  it('failed backend absence proof fails closed with no unsafe restart', async () => {
    const f = await splitRollbackFixture()
    try {
      f.hook = async (args) => {
        if (args.at(-1)?.includes('pg_stat_activity')) return 'f'
      }
      const result = await f.run()
      expect(result.status).toBe(1)
      expect(result.stderr).toContain('sessions are not drained')
      expect(f.containers.every((c) => !c.running)).toBe(true)
      expect(f.calls.some((args) => args[0] === 'start')).toBe(false)
    } finally {
      await f.close()
    }
  })
  it('post-stop IPv6 address reassignment cannot terminate an unrelated owner or authorize recheck', async () => {
    const f = await splitRollbackFixture()
    try {
      expect((await f.run()).status).toBe(0)
      f.network = (value) => ({
        ...value,
        Containers: {
          ...(value.Containers as Record<string, unknown>),
          ['f'.repeat(64)]: { IPv4Address: '172.20.0.99/16', IPv6Address: 'fd00::3/64' },
        },
      })
      const boundary = f.calls.length
      const result = await f.run('recheck')
      expect(result.status).toBe(1)
      expect(result.stderr).toContain('ownership')
      expect(f.calls.slice(boundary).some((args) => args.includes('psql'))).toBe(false)
      expect((await f.run('recover')).status).toBe(1)
      expect(f.calls.slice(boundary).some((args) => args[0] === 'start')).toBe(false)
    } finally {
      await f.close()
    }
  })
  it('recovery drains newly introduced current/partial old writers before captured restart', async () => {
    const f = await splitRollbackFixture()
    try {
      expect((await f.run()).status).toBe(0)
      const additional = { ...f.containers[0]!, id: '6'.repeat(64), running: true }
      f.containers.push(additional)
      const boundary = f.calls.length
      const result = await f.run('recover')
      expect(result.status, result.stderr).toBe(0)
      const recovery = f.calls.slice(boundary)
      expect(recovery.find((args) => args[0] === 'stop')).toContain(additional.id)
      const drain = recovery.find((args) => args.at(-1)?.includes('pg_terminate_backend'))!
      expect(drain.at(-1)).toContain("'172.20.0.6'::inet")
      expect(drain.at(-1)).toContain("'fd00::6'::inet")
      expect(recovery.findIndex((args) => args[0] === 'start')).toBeGreaterThan(
        recovery.indexOf(drain),
      )
      expect(additional.running).toBe(false)
    } finally {
      await f.close()
    }
  })
  it.each([true, false])(
    'existing split requires BOTH target images compatible: bot=%s',
    async (botCompatible) => {
      const f = await splitRollbackFixture()
      try {
        f.options = { splitRows: true }
        f.hook = async (args) => {
          if (args[0] === 'image' && args.at(-1)?.endsWith(`:${f.oldSha}`)) {
            const split = args.at(-1)!.includes('-web:') || botCompatible ? '1' : '0'
            return `sha256:${'9'.repeat(64)}|${f.oldSha}|${split}`
          }
        }
        const result = await f.run()
        expect(result.status, result.stderr).toBe(botCompatible ? 0 : 1)
        expect(f.containers.every((c) => c.running)).toBe(!botCompatible)
      } finally {
        await f.close()
      }
    },
  )
  it('rollback_blocks_old_images_with_split_rows', async () => {
    const f = await splitRollbackFixture()
    try {
      f.options = { splitRows: true }
      const result = await f.run()
      expect(result.status).not.toBe(0)
      expect(result.stderr).toContain('split rows')
      const stopIndex = f.calls.findIndex((c) => c[0] === 'stop')
      expect(f.calls.slice(stopIndex + 1).some((c) => c.includes('psql'))).toBe(true)
      expect(f.containers.every((c) => c.running)).toBe(true)
      expect(f.calls.filter((c) => c[0] === 'start').flat()).toEqual(
        expect.arrayContaining(f.containers.map((c) => c.id)),
      )
      expect(f.calls.some((c) => c.includes('up'))).toBe(false)
    } finally {
      await f.close()
    }
  })
  it('rollback_db_error_fails_closed', async () => {
    const f = await splitRollbackFixture()
    try {
      f.options = { queryError: true }
      const result = await f.run()
      expect(result.status).not.toBe(0)
      expect(result.stderr).toContain('query failed')
      expect(f.containers.every((c) => c.running)).toBe(true)
      expect(f.calls.some((c) => c.includes('up'))).toBe(false)
    } finally {
      await f.close()
    }
  })
  it.each([true, false])('rollback_before_first_split_remains_safe: schema=%s', async (schema) => {
    const f = await splitRollbackFixture()
    try {
      f.options = { schema }
      const result = await f.run()
      expect(result.status, result.stderr).toBe(0)
      expect(f.containers.every((c) => !c.running)).toBe(true)
      const capture = readFileSync(f.snapshot, 'utf8')
      for (const c of f.containers) {
        expect(capture).toContain(c.id)
        expect(capture).toContain(c.image)
        expect(capture).toContain(c.ref)
      }
      const stop = f.calls.find((c) => c[0] === 'stop')!
      expect(stop).toHaveLength(4)
      expect(stop).toEqual(expect.arrayContaining(['stop', ...f.containers.map((c) => c.id)]))
      expect(f.calls.filter((c) => c[0] === 'ps').at(-1)).toContain(
        'label=com.docker.compose.service=bot',
      )
      expect((await f.run('recheck')).status).toBe(0)
    } finally {
      await f.close()
    }
  })
  it('pre-stop image failure preserves running writers and does not query', async () => {
    const f = await splitRollbackFixture()
    try {
      f.options = { preflightError: true }
      expect((await f.run()).status).not.toBe(0)
      expect(f.containers.every((c) => c.running)).toBe(true)
      expect(f.calls.some((c) => c[0] === 'stop' || c.includes('psql'))).toBe(false)
    } finally {
      await f.close()
    }
  })
  it('pre-stop query failure preserves runtime and never stops writers', async () => {
    const f = await splitRollbackFixture()
    try {
      f.hook = async (args) => (args.includes('psql') ? 'invalid-query-result' : undefined)
      const result = await f.run()
      expect(result.status).not.toBe(0)
      expect(result.stderr).toContain('preflight query failed')
      expect(f.containers.every((c) => c.running)).toBe(true)
      expect(f.calls.some((c) => c[0] === 'stop' || c[0] === 'start')).toBe(false)
    } finally {
      await f.close()
    }
  })
  it('stop failure only recovers immutable captured current writers', async () => {
    const f = await splitRollbackFixture()
    try {
      f.options = { stopError: true }
      const result = await f.run()
      expect(result.status).not.toBe(0)
      expect(result.stderr).toContain('writer stop failed')
      expect(f.containers.every((c) => c.running)).toBe(true)
    } finally {
      await f.close()
    }
  })
  it('image revision mismatch fails before stopping or trusting a capability label', async () => {
    const f = await splitRollbackFixture()
    try {
      f.hook = async (args) =>
        args[0] === 'image' && args.at(-1) === `volleytime-web:${f.oldSha}`
          ? `sha256:${'9'.repeat(64)}|${f.currentSha}|1`
          : undefined
      expect((await f.run()).status).not.toBe(0)
      expect(f.calls.some((c) => c[0] === 'stop')).toBe(false)
      expect(f.containers.every((c) => c.running)).toBe(true)
    } finally {
      await f.close()
    }
  })
  it('activation recovery refuses removed or changed captured containers without unsafe fallback', async () => {
    const f = await splitRollbackFixture()
    try {
      expect((await f.run()).status).toBe(0)
      f.containers[0]!.image = `sha256:${'8'.repeat(64)}`
      const result = await f.run('recover')
      expect(result.status).not.toBe(0)
      expect(result.stderr).toContain('safe captured current recovery cannot be confirmed')
      expect(f.calls.some((c) => c[0] === 'start')).toBe(false)
      expect(f.containers.every((c) => !c.running)).toBe(true)
    } finally {
      await f.close()
    }
  })
  it('writer recheck rejects a newly running duplicate and recovers captured current only', async () => {
    const f = await splitRollbackFixture()
    try {
      f.options = { writerAfterQuery: true }
      const result = await f.run()
      expect(result.status).not.toBe(0)
      expect(result.stderr).toContain('writers are running')
      expect(f.calls.filter((c) => c[0] === 'start').flat()).toEqual(
        expect.arrayContaining(f.containers.map((c) => c.id)),
      )
    } finally {
      await f.close()
    }
  })
  it('does not restart a captured fixed-only writer when split compatibility cannot be proved', async () => {
    const f = await splitRollbackFixture()
    try {
      f.containers[0]!.split = '<no value>'
      f.options = { queryError: true }
      expect((await f.run()).status).not.toBe(0)
      expect(f.calls.some((c) => c[0] === 'start')).toBe(false)
      expect(f.containers.every((c) => !c.running)).toBe(true)
    } finally {
      await f.close()
    }
  })
})
