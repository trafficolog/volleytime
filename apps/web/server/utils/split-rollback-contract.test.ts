import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import {
  rollbackCapabilities,
  splitRollbackFixture,
  splitRollbackScript,
} from '../../../../packages/core/src/__tests__/split-rollback-shell-fixture'

// v0.2.0 data predicates for a runtime without the capability (task 20.7.1, items 6, 7, 9).
const v020Capabilities = [
  {
    key: 'multiSeat',
    name: 'multi-seat',
    predicate: 'SELECT EXISTS (SELECT 1 FROM bookings WHERE seats > 1 OR waitlist_seats > 0)',
  },
  {
    key: 'inviteMode',
    name: 'invite-mode',
    predicate:
      "SELECT EXISTS (SELECT 1 FROM events WHERE join_mode = 'invite' AND status NOT IN ('cancelled', 'finished')) OR EXISTS (SELECT 1 FROM invite_links WHERE type = 'event_join' AND NOT is_revoked AND (expires_at IS NULL OR expires_at > now()) AND (max_uses IS NULL OR uses_count < max_uses))",
  },
  {
    key: 'scheduler',
    name: 'scheduler',
    predicate:
      "SELECT EXISTS (SELECT 1 FROM waitlist_offers WHERE status = 'offered') OR EXISTS (SELECT 1 FROM events WHERE booking_opens_at > now() AND status IN ('draft', 'published', 'closed'))",
  },
] as const

describe('v0.2.0 capability labels and data guard (20.7.1)', { timeout: 35_000 }, () => {
  it('web and bot runtime images carry every capability label the guard inspects', () => {
    const guard = readFileSync(splitRollbackScript, 'utf8')
    for (const app of ['web', 'bot']) {
      const dockerfile = readFileSync(
        fileURLToPath(new URL(`../../../${app}/Dockerfile`, import.meta.url)),
        'utf8',
      )
      const runtime = dockerfile.slice(dockerfile.lastIndexOf('\nFROM '))
      expect(runtime).toContain(' AS runtime')
      for (const label of Object.values(rollbackCapabilities)) {
        expect(runtime, `${app} runtime stage`).toContain(`LABEL ${label}="1"`)
        expect(guard).toContain(`{{index .Config.Labels "${label}"}}`)
      }
    }
  })
  it.each(v020Capabilities)(
    'checks the $name schema and exact data predicate only after writers stop',
    async ({ predicate }) => {
      const f = await splitRollbackFixture()
      try {
        const result = await f.run()
        expect(result.status, result.stderr).toBe(0)
        const stop = f.calls.findIndex((args) => args[0] === 'stop')
        const query = f.calls.findIndex(
          (args, index) => index > stop && args.at(-1)?.includes(predicate),
        )
        expect(query, 'authoritative query after stop').toBeGreaterThan(stop)
      } finally {
        await f.close()
      }
    },
  )
  it.each(
    v020Capabilities.flatMap((capability) =>
      (['both', 'web', 'bot'] as const).map((missing) => ({ ...capability, missing })),
    ),
  )(
    'existing $name data denies a target without the label on $missing and recovers current writers',
    async ({ key, name, missing }) => {
      const f = await splitRollbackFixture()
      try {
        f.rows[key] = true
        if (missing !== 'bot') f.targets.web[key] = '<no value>'
        if (missing !== 'web') f.targets.bot[key] = '<no value>'
        const result = await f.run()
        expect(result.status).toBe(1)
        expect(result.stderr).toContain(`${name} rows require compatible web and bot images`)
        expect(f.containers.every((c) => c.running)).toBe(true)
        expect(f.calls.filter((c) => c[0] === 'start').flat()).toEqual(
          expect.arrayContaining(f.containers.map((c) => c.id)),
        )
      } finally {
        await f.close()
      }
    },
  )
  it.each(v020Capabilities)(
    'existing $name data passes when both target images carry the label',
    async ({ key }) => {
      const f = await splitRollbackFixture()
      try {
        f.rows[key] = true
        const result = await f.run()
        expect(result.status, result.stderr).toBe(0)
        expect(f.containers.every((c) => !c.running)).toBe(true)
      } finally {
        await f.close()
      }
    },
  )
  it('a target without any v0.2.0 label passes while no such data exists', async () => {
    const f = await splitRollbackFixture()
    try {
      for (const { key } of v020Capabilities) {
        f.targets.web[key] = '<no value>'
        f.targets.bot[key] = '<no value>'
      }
      const result = await f.run()
      expect(result.status, result.stderr).toBe(0)
      expect(f.containers.every((c) => !c.running)).toBe(true)
    } finally {
      await f.close()
    }
  })
  it('a schema without the v0.2.0 migrations needs no labels and reads no rows', async () => {
    const f = await splitRollbackFixture()
    try {
      f.options = { schema: false }
      for (const { key } of v020Capabilities) {
        f.rows[key] = true
        f.targets.web[key] = '<no value>'
        f.targets.bot[key] = '<no value>'
      }
      const result = await f.run()
      expect(result.status, result.stderr).toBe(0)
      for (const { predicate } of v020Capabilities)
        expect(f.calls.some((args) => args.at(-1)?.includes(predicate))).toBe(false)
    } finally {
      await f.close()
    }
  })
  it('lists every missing capability that existing data requires', async () => {
    const f = await splitRollbackFixture()
    try {
      f.options = { splitRows: true }
      f.rows.scheduler = true
      f.targets.bot.scheduler = '<no value>'
      const result = await f.run()
      expect(result.status).toBe(1)
      expect(result.stderr).toContain('split scheduler rows require compatible web and bot images')
    } finally {
      await f.close()
    }
  })
  it.each(v020Capabilities)(
    'an invalid $name result after stop fails closed and recovers current writers',
    async ({ predicate }) => {
      const f = await splitRollbackFixture()
      try {
        f.hook = async (args) =>
          f.containers.every((c) => !c.running) && args.at(-1)?.includes(predicate)
            ? 'maybe'
            : undefined
        const result = await f.run()
        expect(result.status).toBe(1)
        expect(result.stderr).toContain('authoritative query failed')
        expect(f.containers.every((c) => c.running)).toBe(true)
      } finally {
        await f.close()
      }
    },
  )
  it.each(v020Capabilities)(
    'an unproven $name schema result fails closed before any writer stops',
    async ({ predicate }) => {
      const f = await splitRollbackFixture()
      try {
        const schemaQuery = (query: string) =>
          query.includes('information_schema') &&
          (predicate.includes('waitlist_seats')
            ? query.includes("'waitlist_seats'")
            : predicate.includes('join_mode')
              ? query.includes("'join_mode'")
              : query.includes("'booking_opens_at'"))
        f.hook = async (args) => (schemaQuery(args.at(-1) ?? '') ? '' : undefined)
        const result = await f.run()
        expect(result.status).toBe(1)
        expect(result.stderr).toContain('preflight query failed')
        expect(f.calls.some((c) => c[0] === 'stop')).toBe(false)
      } finally {
        await f.close()
      }
    },
  )
  it.each(v020Capabilities)(
    'recovery never restarts a captured writer without $name support while such data exists',
    async ({ key }) => {
      const f = await splitRollbackFixture()
      try {
        f.containers[0]![key] = '<no value>'
        f.targets.web[key] = '<no value>'
        f.rows[key] = true
        const result = await f.run()
        expect(result.status).toBe(1)
        expect(f.calls.some((c) => c[0] === 'start')).toBe(false)
        expect(f.containers.every((c) => !c.running)).toBe(true)
      } finally {
        await f.close()
      }
    },
  )
  it('every schema and data guard query pins search_path before reading (review of PR #183)', async () => {
    const f = await splitRollbackFixture()
    try {
      const result = await f.run()
      expect(result.status, result.stderr).toBe(0)
      const guardQueries = f.calls
        .filter((args) => args.includes('psql') && !args.at(-1)?.includes('pg_stat_activity'))
        .map((args) => args.at(-1)!)
      // preflight and authoritative pass, each four schema probes and four data predicates
      expect(guardQueries).toHaveLength(16)
      for (const query of guardQueries)
        expect(query.startsWith('SET search_path TO pg_catalog, public; '), query).toBe(true)
    } finally {
      await f.close()
    }
  })
  it.each([
    ['a second command tag', 'SET\nSET\nf'],
    ['a stray line before the SET tag', 'x\nSET\nf'],
    ['a bare SET tag without an answer', 'SET'],
  ])('a guard answer with %s fails closed before any writer stops', async (_name, output) => {
    const f = await splitRollbackFixture()
    try {
      f.hook = async (args) =>
        args.at(-1)?.includes("column_name='join_mode'") ? output : undefined
      const result = await f.run()
      expect(result.status).toBe(1)
      expect(result.stderr).toContain('preflight query failed')
      expect(f.calls.some((c) => c[0] === 'stop')).toBe(false)
    } finally {
      await f.close()
    }
  })
  it('recovery restarts a captured writer without a capability when no such data exists', async () => {
    const f = await splitRollbackFixture()
    try {
      f.containers[0]!.multiSeat = '<no value>'
      expect((await f.run()).status).toBe(0)
      const boundary = f.calls.length
      const result = await f.run('recover')
      expect(
        f.calls.slice(boundary).some((args) => args.at(-1)?.includes('waitlist_seats > 0')),
        'a captured writer without multi-seat support needs the authoritative query',
      ).toBe(true)
      expect(result.status, result.stderr).toBe(0)
      expect(f.containers.every((c) => c.running)).toBe(true)
    } finally {
      await f.close()
    }
  }, 60_000)
})

describe('split rollback boundary (fake Docker shell evidence)', { timeout: 35_000 }, () => {
  it.each(['postgres:172.20.0.1', 'postgres:host-gateway', 'POSTGRES:fd00::1'])(
    'hostname override is refused before stop: %s',
    async (override) => {
      const f = await splitRollbackFixture()
      try {
        f.options = { extraHosts: [override] }
        const result = await f.run()
        expect(result.status).toBe(1)
        expect(result.stderr).toContain('ownership')
        expect(f.calls.some((args) => args[0] === 'stop')).toBe(false)
        expect(f.containers.every((c) => c.running)).toBe(true)
      } finally {
        await f.close()
      }
    },
  )
  it('postgres alias on frontend makes two-network resolution ambiguous and fails before stop', async () => {
    const f = await splitRollbackFixture()
    try {
      f.options = { ambiguousPostgresAlias: true }
      const result = await f.run()
      expect(result.status).toBe(1)
      expect(f.calls.some((args) => args[0] === 'stop')).toBe(false)
    } finally {
      await f.close()
    }
  })
  it('normal production frontend plus backend network remains valid', async () => {
    const f = await splitRollbackFixture()
    try {
      const result = await f.run()
      expect(result.status, result.stderr).toBe(0)
      expect(f.containers.every((c) => !c.running)).toBe(true)
    } finally {
      await f.close()
    }
  })
  it('another frontend container alias makes two-network resolution ambiguous before stop', async () => {
    const f = await splitRollbackFixture()
    try {
      f.options = { ambiguousOtherPostgresAlias: true }
      const result = await f.run()
      expect(result.status).toBe(1)
      expect(f.calls.some((args) => args[0] === 'stop')).toBe(false)
      expect(f.containers.every((c) => c.running)).toBe(true)
    } finally {
      await f.close()
    }
  })
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
  }, 60_000)
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
  }, 60_000)
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
  }, 60_000)
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
  }, 60_000)
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
  it.each([true, false])(
    'rollback_before_first_split_remains_safe: schema=%s',
    async (schema) => {
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
    },
    60_000,
  )
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
  }, 60_000)
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
