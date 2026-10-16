import { closeDb, db, eq, organizations, users, waitlistOffers } from '@volley-time/db'
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { eventService } from '../events/service'
import { memberService } from '../members/service'
import { organizationService } from '../organizations/service'
import { paymentService } from '../payments/service'

import { bookingService } from './service'

/**
 * Состав события для организатора (20.5.6): платежи записи по местам и предложения места из очереди.
 * `bookings.paymentId` указывает на самый ранний живой платёж — он может быть уже `succeeded`, когда
 * ждёт оплаты добавленное место; решать нужно по ожидающему платежу.
 */
describe('organizer roster: pending payments and offers (PostgreSQL)', () => {
  let ownerId: number
  let orgId: number
  const owner = () => ({ userId: ownerId })

  async function player() {
    const [u] = await db
      .insert(users)
      .values({ email: `rp-${Math.random()}@t.by`, name: 'Игрок' })
      .returning()
    await memberService.add(owner(), { organizationId: orgId, userId: u!.id })
    return u!.id
  }

  const makeEvent = (capacity = 6) =>
    eventService.create(owner(), orgId, {
      title: 'Игра',
      startsAt: new Date(Date.now() + 24 * 3600_000),
      endsAt: new Date(Date.now() + 26 * 3600_000),
      capacity,
      price: 1500,
    })

  beforeEach(async () => {
    vi.stubEnv('EVENT_MULTI_SEAT_ENABLED', 'true')
    await db.delete(organizations)
    await db.delete(users)
    const [u] = await db
      .insert(users)
      .values({ email: `o-${Math.random()}@t.by`, name: 'Организатор' })
      .returning()
    ownerId = u!.id
    orgId = (await organizationService.create(owner(), { name: 'Roster payments' })).id
    await db.update(organizations).set({ maxSeatsPerBooking: 5 }).where(eq(organizations.id, orgId))
  })
  afterEach(() => vi.unstubAllEnvs())
  afterAll(async () => {
    await db.delete(organizations)
    await db.delete(users)
    await closeDb()
  })

  it('paid seat first, pending seat second: row exposes only the pending payment to act on', async () => {
    const ev = await makeEvent()
    const p = await player()
    const b = await bookingService.book({ userId: p }, orgId, ev.id, { method: 'cash', seats: 2 })
    await paymentService.confirm(owner(), b.paymentId!, { orgId })
    const grown = await bookingService.changeSeats({ userId: p }, b.id, { seats: 3 })
    expect(grown.booking.status).toBe('pending_payment')
    const live = await paymentService.listLive({ userId: p }, grown.booking)
    const pending = live.filter((x) => x.status === 'pending')
    expect(live[0]!.status).toBe('succeeded')

    const [row] = await bookingService.listByEvent(owner(), orgId, ev.id)
    // bookings.paymentId — самый ранний (уже оплаченный) платёж: действовать по нему нельзя
    expect(row!.paymentId).toBe(live[0]!.id)
    expect(row!.pendingPaymentIds).toEqual(pending.map((x) => x.id))
    expect(row!.pendingPaymentIds).not.toContain(row!.paymentId)
    expect(row!.paidSeats).toBe(live.filter((x) => x.status === 'succeeded').length)
  })

  it('a booking with nothing pending has no pending payments; subscription seats are not paid payments', async () => {
    const ev = await makeEvent()
    const p = await player()
    const b = await bookingService.book({ userId: p }, orgId, ev.id, { method: 'cash' })
    await paymentService.confirm(owner(), b.paymentId!, { orgId })
    const [row] = await bookingService.listByEvent(owner(), orgId, ev.id)
    expect(row).toMatchObject({ pendingPaymentIds: [], paidSeats: 1, allocatedAmount: null })
  })

  it('exposes an active waitlist offer (seats, expiry) and hides expired or absent ones', async () => {
    const ev = await makeEvent(1)
    const first = await player()
    const queued = await player()
    const other = await player()
    await bookingService.book({ userId: first }, orgId, ev.id, { method: 'cash' })
    const q = await bookingService.book({ userId: queued }, orgId, ev.id, { method: 'cash' })
    const o = await bookingService.book({ userId: other }, orgId, ev.id, { method: 'cash' })
    expect([q.status, o.status]).toEqual(['waitlisted', 'waitlisted'])
    const expiresAt = new Date(Date.now() + 20 * 60_000)
    await db.insert(waitlistOffers).values([
      { organizationId: orgId, eventId: ev.id, bookingId: q.id, seats: 1, expiresAt },
      {
        organizationId: orgId,
        eventId: ev.id,
        bookingId: o.id,
        seats: 1,
        offeredAt: new Date(Date.now() - 3600_000),
        expiresAt: new Date(Date.now() - 1800_000),
      },
    ])
    const rows = await bookingService.listByEvent(owner(), orgId, ev.id)
    const byId = new Map(rows.map((r) => [r.id, r]))
    expect(byId.get(q.id)!.offer).toMatchObject({ seats: 1 })
    expect(new Date(byId.get(q.id)!.offer!.expiresAt).getTime()).toBe(expiresAt.getTime())
    expect(byId.get(o.id)!.offer).toBeNull()
    expect(rows.find((r) => r.status === 'pending_payment')!.offer).toBeNull()
  })
})
