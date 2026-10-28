import { closeDb, db, eq, organizations, users } from '@volley-time/db'
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { bookingService } from '../bookings/service'
import { eventService } from '../events/service'
import { memberService } from '../members/service'
import { organizationService } from '../organizations/service'

import { readMySeatPayments } from './player-status'
import { paymentService } from './service'

/** Task 21.1.8 (D-14): статус оплаты мест в API игрока — только свои записи и только счётчики. */
describe('player seat payments (21.1.8, PostgreSQL)', () => {
  let ownerId: number
  let orgId: number
  const owner = () => ({ userId: ownerId })
  const future = (h = 24) => new Date(Date.now() + h * 3600_000)

  async function player(): Promise<number> {
    const [u] = await db
      .insert(users)
      .values({ email: `sp-${Math.random()}@t.by`, name: 'Игрок' })
      .returning()
    await memberService.add(owner(), { organizationId: orgId, userId: u!.id })
    return u!.id
  }

  const makeEvent = () =>
    eventService.create(owner(), orgId, {
      title: 'Игра',
      startsAt: future(),
      endsAt: future(26),
      capacity: 10,
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
    orgId = (await organizationService.create(owner(), { name: 'Status' })).id
  })
  afterEach(() => {
    vi.unstubAllEnvs()
  })
  afterAll(async () => {
    await db.delete(organizations)
    await db.delete(users)
    await closeDb()
  })

  it('shows pending, paid and released paid seats of the player own booking', async () => {
    const ev = await makeEvent()
    const p = await player()
    await db.update(organizations).set({ maxSeatsPerBooking: 5 }).where(eq(organizations.id, orgId))
    const b = await bookingService.book({ userId: p }, orgId, ev.id, { method: 'cash', seats: 2 })
    expect((await readMySeatPayments({ userId: p }, orgId, [b.id])).get(b.id)).toEqual({
      paidSeats: 0,
      pendingSeats: 2,
      releasedPaidSeats: 0,
    })

    await paymentService.confirm(owner(), b.paymentId!, { orgId })
    expect((await readMySeatPayments({ userId: p }, orgId, [b.id])).get(b.id)).toEqual({
      paidSeats: 2,
      pendingSeats: 0,
      releasedPaidSeats: 0,
    })

    // частичная отмена освобождает оплаченное место без возврата
    await bookingService.changeSeats({ userId: p }, b.id, { seats: 1 })
    expect((await readMySeatPayments({ userId: p }, orgId, [b.id])).get(b.id)).toEqual({
      paidSeats: 1,
      pendingSeats: 0,
      releasedPaidSeats: 1,
    })

    // полная отмена: оба оплаченных места освобождены, платёж остаётся оплаченным
    await bookingService.cancel({ userId: p }, b.id)
    expect((await readMySeatPayments({ userId: p }, orgId, [b.id])).get(b.id)).toEqual({
      paidSeats: 0,
      pendingSeats: 0,
      releasedPaidSeats: 2,
    })
  })

  it('unpaid seats cancelled by the player are not reported as paid or released', async () => {
    const ev = await makeEvent()
    const p = await player()
    const b = await bookingService.book({ userId: p }, orgId, ev.id, { method: 'cash' })
    await bookingService.cancel({ userId: p }, b.id)
    expect((await readMySeatPayments({ userId: p }, orgId, [b.id])).get(b.id)).toEqual({
      paidSeats: 0,
      pendingSeats: 0,
      releasedPaidSeats: 0,
    })
  })

  it('starts over after rebooking: the released seats belong to the previous incarnation', async () => {
    const ev = await makeEvent()
    const p = await player()
    const b = await bookingService.book({ userId: p }, orgId, ev.id, { method: 'cash' })
    await paymentService.confirm(owner(), b.paymentId!, { orgId })
    await bookingService.cancel({ userId: p }, b.id)
    await bookingService.book({ userId: p }, orgId, ev.id, { method: 'cash' })
    expect((await readMySeatPayments({ userId: p }, orgId, [b.id])).get(b.id)).toEqual({
      paidSeats: 0,
      pendingSeats: 1,
      releasedPaidSeats: 0,
    })
  })

  it('returns nothing for another player booking or another group', async () => {
    const ev = await makeEvent()
    const p = await player()
    const stranger = await player()
    const b = await bookingService.book({ userId: p }, orgId, ev.id, { method: 'cash' })
    await paymentService.confirm(owner(), b.paymentId!, { orgId })
    await bookingService.cancel({ userId: p }, b.id)

    const other = await organizationService.create(owner(), { name: 'Other' })
    // чужая запись: тот же bookingId от имени другого игрока и от имени организатора
    for (const ctx of [{ userId: stranger }, owner()]) {
      expect((await readMySeatPayments(ctx, orgId, [b.id])).get(b.id)).toEqual({
        paidSeats: 0,
        pendingSeats: 0,
        releasedPaidSeats: 0,
      })
    }
    // та же запись, но в чужом контексте группы
    expect((await readMySeatPayments({ userId: p }, other.id, [b.id])).get(b.id)).toEqual({
      paidSeats: 0,
      pendingSeats: 0,
      releasedPaidSeats: 0,
    })
    expect((await readMySeatPayments({ userId: p }, orgId, [])).size).toBe(0)
  })
})
