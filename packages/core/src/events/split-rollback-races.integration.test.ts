import { spawn, spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'

import { closeDb, db, eq, events, organizations, sql, users } from '@volley-time/db'
import { afterAll, describe, expect, it } from 'vitest'

import { splitRollbackFixture } from '../__tests__/split-rollback-shell-fixture'
import { organizationService } from '../organizations/service'

import { eventService } from './service'

function barrier() {
  let release!: () => void
  let fail!: (error: unknown) => void
  return {
    promise: new Promise<void>((resolve, reject) => {
      release = resolve
      fail = reject
    }),
    release: () => release(),
    fail: (error: unknown) => fail(error),
  }
}

// Isolate killed runtime connections from the shared application test pool.
const require = createRequire(import.meta.url)
const postgres = require(
  require.resolve('postgres', { paths: [require.resolve('@volley-time/db')] }),
) as (url: string, options: Record<string, unknown>) => typeof db.$client

function testPsql(query: string) {
  const inspected = spawnSync(
    'docker',
    ['inspect', '--format', '{{.Id}}|{{.Config.Image}}|{{.State.Running}}', 'volleytime_postgres'],
    { encoding: 'utf8' },
  )
  expect(inspected.status, inspected.stderr).toBe(0)
  const [id, image, running] = inspected.stdout.trim().split('|')
  expect(id).toMatch(/^[0-9a-f]{64}$/)
  expect(image).toBe('postgres:16-alpine')
  expect(running).toBe('true')
  const args = [
    'exec',
    id!,
    'psql',
    '-X',
    '-U',
    'postgres',
    '-d',
    'volleytime_test',
    '-v',
    'ON_ERROR_STOP=1',
    '-Atc',
  ]
  const verified = spawnSync('docker', [...args, 'SELECT current_database();'], {
    encoding: 'utf8',
  })
  expect(verified.stdout.trim()).toBe('volleytime_test')
  const result = spawnSync('docker', [...args, query], { encoding: 'utf8' })
  if (result.status !== 0) throw new Error(result.stderr)
  return result.stdout.trim()
}

describe(
  'split rollback races (real PostgreSQL, simulated container stop)',
  { timeout: 30_000 },
  () => {
    afterAll(closeDb)
    it.each(['already-connected', 'capture-stop-late'] as const)(
      'stopped_container_requires_actual_backend_drain_and_preserves_unrelated_session: %s',
      async (connectionTime) => {
        // Explicitly authorized test-only container; never discover or operate app containers.
        const inspected = spawnSync(
          'docker',
          [
            'inspect',
            '--format',
            '{{.Id}}|{{.Config.Image}}|{{.State.Running}}',
            'volleytime_postgres',
          ],
          { encoding: 'utf8' },
        )
        expect(inspected.status, inspected.stderr).toBe(0)
        const [container, image, running] = inspected.stdout.trim().split('|')
        expect(container).toMatch(/^[0-9a-f]{64}$/)
        expect(image).toBe('postgres:16-alpine')
        expect(running).toBe('true')
        const psqlArgs = [
          'exec',
          '-i',
          container!,
          'psql',
          '-X',
          '-U',
          'postgres',
          '-d',
          'volleytime_test',
          '-At',
        ]
        const verified = spawnSync('docker', [...psqlArgs, '-c', 'SELECT current_database();'], {
          encoding: 'utf8',
        })
        expect(verified.status, verified.stderr).toBe(0)
        expect(verified.stdout.trim()).toBe('volleytime_test')
        const f = await splitRollbackFixture()
        // Mock production ownership uses one real loopback runtime address; host pool is unrelated.
        f.addresses = ['127.0.0.1']
        const [owner] = await db
          .insert(users)
          .values({ email: `drain-${crypto.randomUUID()}@test.by` })
          .returning()
        const org = await organizationService.create(
          { userId: owner!.id },
          { name: 'Backend drain fixture' },
        )
        const event = await eventService.create({ userId: owner!.id }, org.id, {
          title: 'Backend drain',
          startsAt: new Date(Date.now() + 86400000),
          endsAt: new Date(Date.now() + 90000000),
          capacity: 3,
          price: 0,
        })
        const unrelated = postgres(process.env.DATABASE_URL_TEST!, { max: 1 })
        const [unrelatedBefore] =
          await unrelated`SELECT pg_backend_pid() AS pid, inet_client_addr()::text AS address`
        let runtime: ReturnType<typeof spawn> | undefined
        let runtimeExit: Promise<number | null> | undefined
        let pid = 0
        const connectRuntime = async () => {
          const ready = barrier()
          runtime = spawn('docker', [...psqlArgs, '-h', '127.0.0.1'], { stdio: 'pipe' })
          let output = ''
          runtime.stdout!.on('data', (part) => {
            output += String(part)
            const match = output.match(/OWNED\|(\d+)\|127\.0\.0\.1(?:\/32)?\|(\d+)\r?\nREADY/)
            if (match) {
              pid = Number(match[1])
              ready.release()
            } else if (output.includes('READY')) ready.fail(new Error(output))
          })
          runtimeExit = new Promise((resolve, reject) => {
            runtime!.on('error', (error) => {
              ready.fail(error)
              reject(error)
            })
            runtime!.on('close', (code) => {
              if (!pid) ready.fail(new Error(output))
              resolve(code)
            })
          })
          runtime.stdin!.write(
            `BEGIN;\nUPDATE events SET price_mode='split', target_amount=10001 WHERE id='${event.id}';\nSELECT 'OWNED|' || pg_backend_pid() || '|' || host(inet_client_addr()) || '|' || inet_client_port();\n\\echo READY\n`,
          )
          await ready.promise
          expect(unrelatedBefore!.address).not.toBe('127.0.0.1')
        }
        try {
          if (connectionTime === 'already-connected') await connectRuntime()
          f.hook = async (args) => {
            if (args[0] === 'stop') {
              if (!runtime) await connectRuntime()
              expect(
                await db.execute(sql`SELECT pid FROM pg_stat_activity WHERE pid=${pid}`),
              ).toHaveLength(1)
              for (const c of f.containers) c.running = false
              // Docker process stop reports success while this real PG transaction is still alive.
              return ''
            }
            if (args.includes('psql')) {
              const query = args.at(-1)!
              if (f.containers.every((c) => !c.running) && query.includes('information_schema'))
                expect(
                  await db.execute(sql`SELECT pid FROM pg_stat_activity WHERE pid=${pid}`),
                  'authoritative query requires actual backend exit',
                ).toHaveLength(0)
              const result = spawnSync('docker', [...psqlArgs, '-c', query], { encoding: 'utf8' })
              if (result.status !== 0) throw new Error(result.stderr)
              return result.stdout.trim()
            }
          }
          const result = await f.run()
          expect(result.status, result.stderr).toBe(0)
          expect(f.calls.some((args) => args.at(-1)?.includes('pg_terminate_backend'))).toBe(true)
          expect(
            await db.execute(sql`SELECT pid FROM pg_stat_activity WHERE pid=${pid}`),
          ).toHaveLength(0)
          const [survivor] = await unrelated`SELECT pg_backend_pid() AS pid`
          expect(survivor!.pid).toBe(unrelatedBefore!.pid)
          expect(
            (await db.query.events.findFirst({ where: eq(events.id, event.id) }))!.priceMode,
          ).toBe('fixed')
        } finally {
          runtime?.stdin?.end('ROLLBACK;\n\\q\n')
          await runtimeExit
          await unrelated.end({ timeout: 0 })
          await f.close()
          await db.delete(organizations).where(eq(organizations.id, org.id))
          await db.delete(users).where(eq(users.id, owner!.id))
        }
      },
    )
    it.each(['commit', 'terminate'] as const)(
      'inflight_split_before_stop_is_seen_or_rolled_back: %s',
      async (finish) => {
        const f = await splitRollbackFixture()
        const [owner] = await db
          .insert(users)
          .values({ email: `rollback-${crypto.randomUUID()}@test.by` })
          .returning()
        const org = await organizationService.create(
          { userId: owner!.id },
          { name: 'Rollback race fixture' },
        )
        const event = await eventService.create({ userId: owner!.id }, org.id, {
          title: 'Rollback race',
          startsAt: new Date(Date.now() + 86400000),
          endsAt: new Date(Date.now() + 90000000),
          capacity: 3,
          price: 0,
        })
        const ready = barrier()
        const finishWriter = barrier()
        let pid = 0
        const runtime = postgres(process.env.DATABASE_URL_TEST!, { max: 1 })
        const writer = runtime
          .begin(async (tx) => {
            const [session] = await tx`SELECT pg_backend_pid()::int AS pid`
            pid = Number(session!.pid)
            await tx`UPDATE events SET price_mode='split', target_amount=10001 WHERE id=${event.id}`
            ready.release()
            await finishWriter.promise
          })
          .catch((error: unknown) => {
            ready.fail(error)
            throw error
          })
          .then(
            () => 'committed' as const,
            () => 'rolled-back' as const,
          )
        try {
          await ready.promise
          expect(
            (await db.query.events.findFirst({ where: eq(events.id, event.id) }))!.priceMode,
          ).toBe('fixed')
          f.hook = async (args) => {
            if (args[0] === 'stop') {
              if (finish === 'terminate') await runtime.end({ timeout: 0 })
              finishWriter.release()
              await writer
              for (const c of f.containers) c.running = false
              return ''
            }
            if (args.includes('psql')) {
              return testPsql(args.at(-1)!)
            }
          }
          const result = await f.run()
          expect(
            f.calls.some((c) => c[0] === 'stop'),
            'production guard must stop writers before authoritative PostgreSQL query',
          ).toBe(true)
          expect(result.status, result.stderr).toBe(finish === 'commit' ? 1 : 0)
          expect(await writer).toBe(finish === 'commit' ? 'committed' : 'rolled-back')
          if (finish === 'terminate')
            expect(
              await db.execute(sql`SELECT pid FROM pg_stat_activity WHERE pid=${pid}`),
            ).toHaveLength(0)
          expect(
            (await db.query.events.findFirst({ where: eq(events.id, event.id) }))!.priceMode,
          ).toBe(finish === 'commit' ? 'split' : 'fixed')
        } finally {
          finishWriter.release()
          await writer
          await runtime.end({ timeout: 0 })
          await f.close()
          await db.delete(organizations).where(eq(organizations.id, org.id))
          await db.delete(users).where(eq(users.id, owner!.id))
        }
      },
    )

    it('split_cannot_commit_between_guard_and_old_activation', async () => {
      const f = await splitRollbackFixture()
      const [owner] = await db
        .insert(users)
        .values({ email: `rollback-window-${crypto.randomUUID()}@test.by` })
        .returning()
      const org = await organizationService.create(
        { userId: owner!.id },
        { name: 'Rollback window fixture' },
      )
      const event = await eventService.create({ userId: owner!.id }, org.id, {
        title: 'Rollback window',
        startsAt: new Date(Date.now() + 86400000),
        endsAt: new Date(Date.now() + 90000000),
        capacity: 3,
        price: 0,
      })
      const ready = barrier()
      const tryLateWrite = barrier()
      const attempted = barrier()
      let pid = 0
      let rejected = false
      const runtime = postgres(process.env.DATABASE_URL_TEST!, { max: 1 })
      const writer = runtime
        .begin(async (tx) => {
          const [session] = await tx`SELECT pg_backend_pid()::int AS pid`
          pid = Number(session!.pid)
          ready.release()
          await tryLateWrite.promise
          try {
            // The stopped runtime's real connection cannot begin or commit another request.
            await tx`UPDATE events SET price_mode='split', target_amount=10001 WHERE id=${event.id}`
          } catch {
            rejected = true
          } finally {
            attempted.release()
          }
        })
        .catch((error: unknown) => {
          ready.fail(error)
          throw error
        })
        .then(
          () => false,
          () => true,
        )
      try {
        await ready.promise
        f.hook = async (args) => {
          if (args[0] === 'stop') {
            await runtime.end({ timeout: 0 })
            for (const c of f.containers) c.running = false
            return ''
          }
          if (args.includes('psql')) {
            return testPsql(args.at(-1)!)
          }
        }
        const result = await f.run()
        expect(result.status, result.stderr).toBe(0)
        expect(
          f.calls.some((c) => c[0] === 'stop'),
          'guard must establish runtime quiescence',
        ).toBe(true)
        tryLateWrite.release()
        await attempted.promise
        expect(rejected).toBe(true)
        expect(await writer).toBe(true)
        await expect(
          runtime.begin(
            async (tx) =>
              tx`UPDATE events SET price_mode='split', target_amount=10001 WHERE id=${event.id}`,
          ),
        ).rejects.toThrow()
        expect(
          (await db.query.events.findFirst({ where: eq(events.id, event.id) }))!.priceMode,
        ).toBe('fixed')
        expect(
          await db.execute(sql`SELECT pid FROM pg_stat_activity WHERE pid=${pid}`),
        ).toHaveLength(0)
        expect((await f.run('recheck')).status).toBe(0)
        expect(f.containers.every((c) => !c.running)).toBe(true)
      } finally {
        tryLateWrite.release()
        await writer
        await runtime.end({ timeout: 0 })
        await f.close()
        await db.delete(organizations).where(eq(organizations.id, org.id))
        await db.delete(users).where(eq(users.id, owner!.id))
      }
    })
  },
)
