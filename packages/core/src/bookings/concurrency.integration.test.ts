import { closeDb, db, organizations, users } from '@volley-time/db'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'

import { eventService } from '../events/service'
import { memberService } from '../members/service'
import { organizationService } from '../organizations/service'

import { bookingService } from './service'

let ownerId: number
let orgId: number

const future = (h = 24) => new Date(Date.now() + h * 3600_000)

async function newPlayer() {
  const [u] = await db
    .insert(users)
    .values({ email: `c-${Math.random()}@t.by` })
    .returning()
  await memberService.add({ userId: ownerId }, { organizationId: orgId, userId: u!.id })
  return u!.id
}

describe('booking concurrency (advisory lock)', () => {
  beforeEach(async () => {
    await db.delete(organizations)
    await db.delete(users)
    const [u] = await db
      .insert(users)
      .values({ email: `o-${Math.random()}@t.by` })
      .returning()
    ownerId = u!.id
    const org = await organizationService.create({ userId: ownerId }, { name: 'Race Org' })
    orgId = org.id
  })

  it('last spot: concurrent book → exactly one confirmed, other waitlisted', async () => {
    const ev = await eventService.create({ userId: ownerId }, orgId, {
      title: 'Last Spot',
      startsAt: future(),
      endsAt: future(26),
      capacity: 1,
      price: 0,
    })
    const p1 = await newPlayer()
    const p2 = await newPlayer()

    const results = await Promise.allSettled([
      bookingService.book({ userId: p1 }, orgId, ev.id, { method: 'free' }),
      bookingService.book({ userId: p2 }, orgId, ev.id, { method: 'free' }),
    ])

    const statuses = results
      .filter(
        (r): r is PromiseFulfilledResult<Awaited<ReturnType<typeof bookingService.book>>> =>
          r.status === 'fulfilled',
      )
      .map((r) => r.value.status)
      .sort()

    // ровно один confirmed, один waitlisted (capacity=1 не превышена)
    expect(statuses).toEqual(['confirmed', 'waitlisted'])
  })

  it('over-capacity: N concurrent bookers on capacity=3 → exactly 3 confirmed', async () => {
    const CAP = 3
    const N = 8
    const ev = await eventService.create({ userId: ownerId }, orgId, {
      title: 'Stress',
      startsAt: future(),
      endsAt: future(26),
      capacity: CAP,
      price: 0,
    })
    const players = await Promise.all(Array.from({ length: N }, () => newPlayer()))

    const results = await Promise.allSettled(
      players.map((pid) => bookingService.book({ userId: pid }, orgId, ev.id, { method: 'free' })),
    )

    const confirmed = results.filter(
      (r) => r.status === 'fulfilled' && r.value.status === 'confirmed',
    ).length
    const waitlisted = results.filter(
      (r) => r.status === 'fulfilled' && r.value.status === 'waitlisted',
    ).length

    // критичный инвариант: НИКОГДА не больше capacity confirmed
    expect(confirmed).toBe(CAP)
    expect(confirmed + waitlisted).toBe(N)
  })

  afterAll(async () => {
    await db.delete(organizations)
    await db.delete(users)
    await closeDb()
  })
})
