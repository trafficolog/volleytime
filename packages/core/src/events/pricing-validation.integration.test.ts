import {
  bookings,
  closeDb,
  db,
  eq,
  events,
  organizations,
  organizationMembers,
  payments,
  sql,
  users,
} from '@volley-time/db'
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { bookingService } from '../bookings/service'
import type { PendingNotification } from '../notifier/types'
import { organizationService } from '../organizations/service'

import { CreateEventInput, UpdateEventInput } from './schemas'
import { eventService } from './service'

let ownerId: number
let orgId: number
const base = () => ({
  title: 'Split training',
  startsAt: new Date(Date.now() + 86400000),
  endsAt: new Date(Date.now() + 93600000),
  capacity: 4,
})
const split = () => ({ ...base(), priceMode: 'split' as const, price: 0, targetAmount: 10000 })

function barrier() {
  let resolve!: () => void
  const promise = new Promise<void>((done) => {
    resolve = done
  })
  return { promise, resolve }
}

async function waitForEventLock(eventId: number): Promise<void> {
  const deadline = Date.now() + 3000
  while (Date.now() < deadline) {
    const rows = await db.execute(
      sql`SELECT 1 FROM pg_locks WHERE locktype = 'advisory' AND objid = ${eventId} AND NOT granted`,
    )
    if (rows.length > 0) return
    await new Promise((resolve) => setTimeout(resolve, 10))
  }
  throw new Error(`Mutation did not wait for event lock ${eventId}`)
}

describe('pricing validation and staging safety (PostgreSQL)', () => {
  beforeEach(async () => {
    await db.delete(organizations)
    await db.delete(users)
    const [owner] = await db
      .insert(users)
      .values({ email: `pricing-${Math.random()}@test.by` })
      .returning()
    ownerId = owner!.id
    orgId = (await organizationService.create({ userId: ownerId }, { name: 'Pricing org' })).id
    vi.stubEnv('EVENT_SPLIT_PRICING_ENABLED', 'true')
  })
  afterEach(() => vi.unstubAllEnvs())
  afterAll(async () => {
    await db.delete(organizations)
    await db.delete(users)
    await closeDb()
  })

  it('preserves legacy free and fixed pricing', async () => {
    const free = await eventService.create({ userId: ownerId }, orgId, base())
    const paid = await eventService.create({ userId: ownerId }, orgId, { ...base(), price: 1500 })
    expect(free).toMatchObject({ priceMode: 'fixed', price: 0, targetAmount: null })
    expect(paid).toMatchObject({ priceMode: 'fixed', price: 1500, targetAmount: null })
  })
  it.each([undefined, 'false', 'TRUE'])('rejects creation with capability %s', async (flag) => {
    vi.stubEnv('EVENT_SPLIT_PRICING_ENABLED', flag)
    await expect(eventService.create({ userId: ownerId }, orgId, split())).rejects.toThrow()
    expect(await db.select().from(events)).toHaveLength(0)
  })
  it('creates split only with exact true and organization currency', async () => {
    const event = await eventService.create({ userId: ownerId }, orgId, split())
    expect(event).toMatchObject({
      priceMode: 'split',
      price: 0,
      targetAmount: 10000,
      currency: 'BYN',
    })
    await expect(
      eventService.create({ userId: ownerId }, orgId, { ...split(), currency: 'USD' }),
    ).rejects.toThrow(/does not match/)
  })
  it.each([
    { priceMode: 'split', price: 1, targetAmount: 100 },
    { priceMode: 'split', targetAmount: 0 },
    { priceMode: 'split', targetAmount: 2147483648 },
    { priceMode: 'split', targetAmount: 1.1 },
    { priceMode: 'split' },
    { priceMode: 'fixed', targetAmount: 100 },
    { price: 2147483648 },
  ])('rejects incompatible input before database access %#', (pricing) => {
    expect(CreateEventInput.safeParse({ ...base(), ...pricing }).success).toBe(false)
  })
  it.each(['pricingSettledAt', 'pricingParticipantCount', 'allocatedAmount'])(
    'rejects client-owned %s on POST and PATCH',
    (field) => {
      expect(CreateEventInput.safeParse({ ...base(), [field]: 1 }).success).toBe(false)
      expect(UpdateEventInput.safeParse({ [field]: 1 }).success).toBe(false)
    },
  )
  it('keeps existing split mode on ordinary PATCH when flag is off', async () => {
    const event = await eventService.create({ userId: ownerId }, orgId, split())
    vi.stubEnv('EVENT_SPLIT_PRICING_ENABLED', 'false')
    const updated = await eventService.update({ userId: ownerId }, event.id, {
      title: 'Renamed',
      targetAmount: 12000,
    })
    expect(updated).toMatchObject({ priceMode: 'split', targetAmount: 12000, title: 'Renamed' })
  })
  it('checks capability on transition into split', async () => {
    const event = await eventService.create({ userId: ownerId }, orgId, base())
    vi.stubEnv('EVENT_SPLIT_PRICING_ENABLED', 'false')
    await expect(
      eventService.update({ userId: ownerId }, event.id, {
        priceMode: 'split',
        targetAmount: 10000,
      }),
    ).rejects.toThrow()
    vi.stubEnv('EVENT_SPLIT_PRICING_ENABLED', 'true')
    expect(
      await eventService.update({ userId: ownerId }, event.id, {
        priceMode: 'split',
        targetAmount: 10000,
      }),
    ).toMatchObject({ priceMode: 'split', targetAmount: 10000 })
  })
  it('rejects retained closed status on fixed-to-split conversion and preserves the fixed event', async () => {
    const event = await eventService.create({ userId: ownerId }, orgId, base())
    expect(
      (await eventService.update({ userId: ownerId }, event.id, { status: 'closed' })).status,
    ).toBe('closed')
    await expect(
      eventService.update({ userId: ownerId }, event.id, {
        priceMode: 'split',
        targetAmount: 10000,
      }),
    ).rejects.toMatchObject({ code: 'event.settlement_required' })
    expect(await eventService.getById({ userId: ownerId }, event.id)).toMatchObject({
      priceMode: 'fixed',
      status: 'closed',
      targetAmount: null,
      pricingSettledAt: null,
      pricingParticipantCount: null,
    })
  })
  it.each(['published', 'draft'] as const)(
    'allows closed fixed conversion when the same PATCH explicitly changes status to %s',
    async (status) => {
      const event = await eventService.create({ userId: ownerId }, orgId, base())
      await eventService.update({ userId: ownerId }, event.id, { status: 'closed' })
      expect(
        await eventService.update({ userId: ownerId }, event.id, {
          priceMode: 'split',
          targetAmount: 10000,
          status,
        }),
      ).toMatchObject({
        priceMode: 'split',
        status,
        targetAmount: 10000,
        pricingSettledAt: null,
        pricingParticipantCount: null,
      })
    },
  )

  it.each(['cancelled', 'waitlisted'] as const)(
    'rejects mode change after %s-only booking history',
    async (status) => {
      const event = await eventService.create({ userId: ownerId }, orgId, base())
      await db.insert(bookings).values({
        eventId: event.id,
        userId: ownerId,
        organizationId: orgId,
        status,
        method: 'free',
      })
      await expect(
        eventService.update({ userId: ownerId }, event.id, {
          priceMode: 'split',
          targetAmount: 10000,
        }),
      ).rejects.toThrow()
      expect(await eventService.getById({ userId: ownerId }, event.id)).toMatchObject({
        priceMode: 'fixed',
      })
    },
  )
  it.each(['closed', 'finished'] as const)(
    'rejects unsettled split PATCH status %s',
    async (status) => {
      const event = await eventService.create({ userId: ownerId }, orgId, split())
      await expect(eventService.update({ userId: ownerId }, event.id, { status })).rejects.toThrow()
      expect((await eventService.getById({ userId: ownerId }, event.id)).status).toBe('published')
    },
  )
  it('rejects target change and reopening after settlement, permits ordinary edits', async () => {
    const event = await eventService.create({ userId: ownerId }, orgId, split())
    await db
      .update(events)
      .set({ pricingSettledAt: new Date(), pricingParticipantCount: 2, status: 'closed' })
      .where(eq(events.id, event.id))
    await expect(
      eventService.update({ userId: ownerId }, event.id, { targetAmount: 9999 }),
    ).rejects.toThrow()
    await expect(
      eventService.update({ userId: ownerId }, event.id, { status: 'published' }),
    ).rejects.toThrow()
    await expect(
      eventService.update({ userId: ownerId }, event.id, { status: 'draft' }),
    ).rejects.toThrow()
    expect(
      (await eventService.update({ userId: ownerId }, event.id, { title: 'Settled event' })).title,
    ).toBe('Settled event')
  })
  it('validates merged PATCH pricing and allows clean switch back to fixed before history', async () => {
    const event = await eventService.create({ userId: ownerId }, orgId, split())
    await expect(eventService.update({ userId: ownerId }, event.id, { price: 1 })).rejects.toThrow()
    const updated = await eventService.update({ userId: ownerId }, event.id, {
      priceMode: 'fixed',
      targetAmount: null,
      price: 1000,
    })
    expect(updated).toMatchObject({ priceMode: 'fixed', price: 1000, targetAmount: null })
  })
  it('rejects financial edits by a player', async () => {
    const event = await eventService.create({ userId: ownerId }, orgId, split())
    const [player] = await db
      .insert(users)
      .values({ email: `player-${Math.random()}@test.by` })
      .returning()
    await db
      .insert(organizationMembers)
      .values({ organizationId: orgId, userId: player!.id, role: 'player', status: 'active' })
    await expect(
      eventService.update({ userId: player!.id }, event.id, { targetAmount: 9999 }),
    ).rejects.toThrow()
    expect((await eventService.getById({ userId: ownerId }, event.id)).targetAmount).toBe(10000)
  })
  it('fails closed on split cash booking before full reservation flow exists', async () => {
    const event = await eventService.create({ userId: ownerId }, orgId, split())
    const notifications: PendingNotification[] = []
    await expect(
      bookingService.book({ userId: ownerId, notifications }, orgId, event.id, { method: 'cash' }),
    ).rejects.toThrow()
    expect(await db.select().from(bookings)).toHaveLength(0)
    expect(await db.select().from(payments)).toHaveLength(0)
    expect(notifications).toEqual([])
  })
  it('fails closed on split cash waitlist promotion before full flow exists', async () => {
    const event = await eventService.create({ userId: ownerId }, orgId, split())
    const [waiting] = await db
      .insert(bookings)
      .values({
        eventId: event.id,
        userId: ownerId,
        organizationId: orgId,
        status: 'waitlisted',
        method: 'cash',
      })
      .returning()
    const notifications: PendingNotification[] = []
    await expect(
      db.transaction((tx) =>
        bookingService.promoteFromWaitlist({ userId: ownerId, db: tx, notifications }, event.id),
      ),
    ).rejects.toThrow()
    expect(
      await db.query.bookings.findFirst({ where: eq(bookings.id, waiting!.id) }),
    ).toMatchObject({ status: 'waitlisted', method: 'cash', paymentId: null })
    expect(await db.select().from(payments)).toHaveLength(0)
    expect(notifications).toEqual([])
  })

  it('reads settlement only after waiting for the event lock during target edit', async () => {
    const event = await eventService.create({ userId: ownerId }, orgId, split())
    const acquired = barrier()
    const release = barrier()
    const locker = db.transaction(async (tx) => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(${event.id})`)
      acquired.resolve()
      await release.promise
      await tx
        .update(events)
        .set({ pricingSettledAt: new Date(), pricingParticipantCount: 2, status: 'closed' })
        .where(eq(events.id, event.id))
    })
    await acquired.promise
    const update = eventService.update({ userId: ownerId }, event.id, { targetAmount: 12000 }).then(
      (value) => ({ value }),
      (error: unknown) => ({ error }),
    )
    try {
      await waitForEventLock(event.id)
    } finally {
      release.resolve()
      await locker
    }
    expect(await update).toMatchObject({ error: { code: 'event.pricing_locked' } })
    expect((await eventService.getById({ userId: ownerId }, event.id)).targetAmount).toBe(10000)
  })

  it('reads newly committed split mode after waiting for the booking event lock', async () => {
    const event = await eventService.create({ userId: ownerId }, orgId, base())
    const acquired = barrier()
    const release = barrier()
    const locker = db.transaction(async (tx) => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(${event.id})`)
      await tx
        .update(events)
        .set({ priceMode: 'split', targetAmount: 10000 })
        .where(eq(events.id, event.id))
      acquired.resolve()
      await release.promise
    })
    await acquired.promise
    const notifications: PendingNotification[] = []
    const book = bookingService
      .book({ userId: ownerId, notifications }, orgId, event.id, { method: 'cash' })
      .then(
        (value) => ({ value }),
        (error: unknown) => ({ error }),
      )
    try {
      await waitForEventLock(event.id)
    } finally {
      release.resolve()
      await locker
    }
    expect(await book).toMatchObject({ error: { code: 'booking.event_not_bookable' } })
    expect(await db.select().from(bookings)).toHaveLength(0)
    expect(await db.select().from(payments)).toHaveLength(0)
    expect(notifications).toEqual([])
  })
})
