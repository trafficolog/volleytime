import { db, sql } from '@volley-time/db'
import { expect } from 'vitest'

/** Queue real service transactions in a proven PostgreSQL lock order, then release together. */
export async function behindEventLock(eventId: number, operations: (() => Promise<unknown>)[]) {
  let unlock!: () => void
  let ready!: () => void
  let failed!: (error: unknown) => void
  let blockerPid = 0
  const released = new Promise<void>((resolve) => (unlock = resolve))
  const locked = new Promise<void>((resolve, reject) => {
    ready = resolve
    failed = reject
  })
  const blocker = db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(${eventId})`)
    const [session] = await tx.execute(sql`SELECT pg_backend_pid()::int AS pid`)
    blockerPid = Number(session!.pid)
    ready()
    await released
  })
  void blocker.catch(failed)
  const pending: Promise<PromiseSettledResult<unknown>>[] = []
  const queuedPids: number[] = []
  let outcomes: PromiseSettledResult<unknown>[] = []
  let barrierFailed = false
  let failure: unknown
  try {
    await locked
    for (const operation of operations) {
      // Observe rejections immediately, including when the barrier assertion itself fails.
      pending.push(
        operation().then(
          (value) => ({ status: 'fulfilled' as const, value }),
          (reason: unknown) => ({ status: 'rejected' as const, reason }),
        ),
      )
      const deadline = Date.now() + 10_000
      let waiting: number[] = []
      do {
        const rows = await db.execute(sql`
          SELECT l.pid::int AS pid FROM pg_locks l
          WHERE l.locktype = 'advisory' AND NOT l.granted
            AND l.classid = 0 AND l.objid = ${eventId} AND l.objsubid = 1
            AND l.database = (SELECT oid FROM pg_database WHERE datname = current_database())
            AND ${blockerPid} = ANY(pg_blocking_pids(l.pid))`)
        waiting = rows.map((row) => Number(row.pid))
        if (waiting.length === pending.length) break
      } while (Date.now() < deadline)
      expect(
        waiting,
        'all launched transactions must actually wait on this event lock',
      ).toHaveLength(pending.length)
      expect(waiting).toEqual(expect.arrayContaining(queuedPids))
      const added = waiting.filter((pid) => !queuedPids.includes(pid))
      expect(added).toHaveLength(1)
      queuedPids.push(added[0]!)
    }
  } catch (error) {
    barrierFailed = true
    failure = error
  } finally {
    unlock()
    try {
      await blocker
    } catch (error) {
      if (!barrierFailed) {
        barrierFailed = true
        failure = error
      }
    } finally {
      outcomes = await Promise.all(pending)
    }
  }
  if (barrierFailed) throw failure
  return outcomes
}
