import { closeDb, db, eq, organizations, payments, users } from '@volley-time/db'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'

import { eventService } from '../events/service'
import { memberService } from '../members/service'
import { organizationService } from '../organizations/service'

import { bookingService } from './service'

/** Task 5.13.7 (review 5 P1#7): параллельные отмены — одна позиция, один продвинутый игрок. */
describe('parallel cancellations (integration)', () => {
  let ownerId: number
  let orgId: number
  const newPlayer = async () => {
    const [u] = await db
      .insert(users)
      .values({ email: `cr-${Math.random()}@t.by` })
      .returning()
    await memberService.add({ userId: ownerId }, { organizationId: orgId, userId: u!.id })
    return u!.id
  }

  beforeEach(async () => {
    await db.delete(organizations)
    await db.delete(users)
    const [o] = await db.insert(users).values({ email: `cr-owner@t.by` }).returning()
    ownerId = o!.id
    orgId = (await organizationService.create({ userId: ownerId }, { name: 'Race Cancel' })).id
  })

  it('N cancels promote N distinct waitlisted players, ≤1 pending payment each (5 runs)', async () => {
    const N = 3
    for (let run = 0; run < 5; run++) {
      const ev = await eventService.create({ userId: ownerId }, orgId, {
        title: `Race ${run}`,
        startsAt: new Date(Date.now() + 72 * 3600_000),
        endsAt: new Date(Date.now() + 74 * 3600_000),
        capacity: N,
        price: 1500,
      })
      const main: number[] = []
      for (let i = 0; i < N; i++) {
        const pid = await newPlayer()
        main.push((await bookingService.book({ userId: pid }, orgId, ev.id, { method: 'cash' })).id)
      }
      const waiting: number[] = []
      for (let i = 0; i < N + 1; i++) {
        const pid = await newPlayer()
        waiting.push(pid)
        await bookingService.book({ userId: pid }, orgId, ev.id, { method: 'cash' })
      }
      // двойные отмены одной и той же брони + параллельные отмены разных
      const results = await Promise.allSettled([
        ...main.map((id) => bookingService.cancel({ userId: ownerId }, id, { byAdmin: true })),
        ...main.map((id) => bookingService.cancel({ userId: ownerId }, id, { byAdmin: true })),
      ])
      expect(results.every((r) => r.status === 'fulfilled')).toBe(true)
      const promoted = results
        .map((r) => (r.status === 'fulfilled' ? r.value.promoted : null))
        .filter((p): p is NonNullable<typeof p> => p !== null)
      expect(promoted).toHaveLength(N)
      expect(new Set(promoted.map((p) => p.userId)).size).toBe(N)

      for (const pid of waiting) {
        const pending = await db.select().from(payments).where(eq(payments.userId, pid))
        expect(pending.filter((p) => p.status === 'pending').length).toBeLessThanOrEqual(1)
      }
    }
  })

  afterAll(async () => {
    await db.delete(organizations)
    await db.delete(users)
    await closeDb()
  })
})
