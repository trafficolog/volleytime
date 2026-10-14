import {
  and,
  asc,
  bookings,
  closeDb,
  db,
  eq,
  ledgerEntries,
  organizations,
  payments,
  users,
} from '@volley-time/db'
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { readEventPriceQuote, readEventPricing } from '../events/pricing-read-model'
import { eventPricingService } from '../events/pricing-service'
import { eventService } from '../events/service'
import { memberService } from '../members/service'
import type { PendingNotification } from '../notifier/types'
import { organizationService } from '../organizations/service'
import { paymentService } from '../payments/service'
import { planService } from '../subscription-plans/service'
import { subscriptionService } from '../subscriptions/service'

import { bookingService } from './service'

/**
 * Task 20.1.2 (P-05, ADR v3 «Места в записи», «Денежная модель нескольких мест», D-03, D-14):
 * запись на несколько мест, частичная очередь с явным согласием, частичная отмена, деньги по месту,
 * абонемент по месту, split по единицам-местам, отмена события.
 */
describe('multi-seat booking (20.1.2, PostgreSQL)', () => {
  let ownerId: number
  let orgId: number
  const owner = () => ({ userId: ownerId })
  const future = (h = 24) => new Date(Date.now() + h * 3600_000)

  async function player(): Promise<number> {
    const [u] = await db
      .insert(users)
      .values({ email: `ms-${Math.random()}@t.by`, name: 'Игрок' })
      .returning()
    await memberService.add(owner(), { organizationId: orgId, userId: u!.id })
    return u!.id
  }

  async function makeEvent(over: { capacity?: number; price?: number } = {}) {
    return eventService.create(owner(), orgId, {
      title: 'Игра',
      startsAt: future(),
      endsAt: future(26),
      capacity: over.capacity ?? 10,
      price: over.price ?? 1500,
    })
  }

  const livePayments = (bookingId: number) =>
    db.select().from(payments).where(eq(payments.bookingId, bookingId)).orderBy(asc(payments.id))

  const reload = async (id: number) =>
    (await db.query.bookings.findFirst({ where: eq(bookings.id, id) }))!

  beforeEach(async () => {
    vi.stubEnv('EVENT_MULTI_SEAT_ENABLED', 'true')
    await db.delete(organizations)
    await db.delete(users)
    const [u] = await db
      .insert(users)
      .values({ email: `o-${Math.random()}@t.by`, name: 'Организатор' })
      .returning()
    ownerId = u!.id
    orgId = (await organizationService.create(owner(), { name: 'Seats' })).id
    await db.update(organizations).set({ maxSeatsPerBooking: 5 }).where(eq(organizations.id, orgId))
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  afterAll(async () => {
    await db.delete(organizations)
    await db.delete(users)
    await closeDb()
  })

  it('fixed cash: one pending payment per seat, one organizer notification for the booking', async () => {
    const ev = await makeEvent()
    const p = await player()
    const notifications: PendingNotification[] = []
    const b = await bookingService.book({ userId: p, notifications }, orgId, ev.id, {
      method: 'cash',
      seats: 3,
    })
    expect(b).toMatchObject({ status: 'pending_payment', seats: 3, waitlistSeats: 0 })
    const rows = await livePayments(b.id)
    expect(rows.map((r) => [r.amount, r.status, r.bookingIncarnation])).toEqual([
      [1500, 'pending', 1],
      [1500, 'pending', 1],
      [1500, 'pending', 1],
    ])
    expect(b.paymentId).toBe(rows[0]!.id)
    const organizer = notifications.filter((n) => n.type === 'payment_pending_organizer')
    expect(organizer).toHaveLength(1)
    expect(organizer[0]!.params).toMatchObject({ amount: 4500, seats: 3 })
    expect(notifications.find((n) => n.userId === p)!.params).toMatchObject({
      amount: 4500,
      seats: 3,
    })

    // организатор видит одну строку «ждут оплаты» на запись
    const pending = await paymentService.listPending(owner(), orgId)
    expect(pending).toHaveLength(1)
    expect(pending[0]).toMatchObject({ id: rows[0]!.id, amount: 4500, seats: 3 })
  })

  it('rejects more seats than the group limit or capacity and keeps one seat behind the flag', async () => {
    const ev = await makeEvent({ capacity: 4 })
    const p = await player()
    await expect(
      bookingService.book({ userId: p }, orgId, ev.id, { method: 'cash', seats: 6 }),
    ).rejects.toMatchObject({ code: 'booking.seats_over_limit' })
    await db
      .update(organizations)
      .set({ maxSeatsPerBooking: 10 })
      .where(eq(organizations.id, orgId))
    await expect(
      bookingService.book({ userId: p }, orgId, ev.id, { method: 'cash', seats: 5 }),
    ).rejects.toMatchObject({ code: 'booking.seats_over_limit' })

    vi.stubEnv('EVENT_MULTI_SEAT_ENABLED', 'false')
    await expect(
      bookingService.book({ userId: p }, orgId, ev.id, { method: 'cash', seats: 2 }),
    ).rejects.toMatchObject({ code: 'booking.multi_seat_disabled' })
    const one = await bookingService.book({ userId: p }, orgId, ev.id, { method: 'cash' })
    expect(one).toMatchObject({ seats: 1, waitlistSeats: 0, status: 'pending_payment' })
    await expect(
      bookingService.changeSeats({ userId: p }, one.id, { seats: 2 }),
    ).rejects.toMatchObject({ code: 'booking.multi_seat_disabled' })
  })

  it('partial main + queue only with explicit consent; full event queues all seats', async () => {
    const ev = await makeEvent({ capacity: 4 })
    const a = await player()
    const b = await player()
    const c = await player()
    await bookingService.book({ userId: a }, orgId, ev.id, { method: 'cash', seats: 2 })
    await expect(
      bookingService.book({ userId: b }, orgId, ev.id, { method: 'cash', seats: 3 }),
    ).rejects.toMatchObject({ code: 'booking.not_enough_seats', freeSeats: 2 })
    expect(await db.select().from(bookings).where(eq(bookings.userId, b))).toHaveLength(0)

    const partial = await bookingService.book({ userId: b }, orgId, ev.id, {
      method: 'cash',
      seats: 3,
      allowWaitlist: true,
    })
    expect(partial).toMatchObject({ status: 'pending_payment', seats: 2, waitlistSeats: 1 })
    expect(await livePayments(partial.id)).toHaveLength(2)

    const queued = await bookingService.book({ userId: c }, orgId, ev.id, {
      method: 'cash',
      seats: 2,
    })
    expect(queued).toMatchObject({ status: 'waitlisted', seats: 2, waitlistSeats: 0 })
    expect(await livePayments(queued.id)).toHaveLength(0)

    const stats = (await eventService.statsFor({ userId: b }, [ev.id])).get(ev.id)!
    expect(stats).toMatchObject({ taken: 4, players: 2, waitlist: 3 })
    expect(stats.myBooking).toMatchObject({ seats: 2, waitlistSeats: 1 })
  })

  it('confirming one seat payment confirms every pending seat of the booking at once', async () => {
    const ev = await makeEvent()
    const p = await player()
    const b = await bookingService.book({ userId: p }, orgId, ev.id, {
      method: 'transfer',
      seats: 3,
    })
    const notifications: PendingNotification[] = []
    await paymentService.confirm({ ...owner(), notifications }, b.paymentId!, { orgId })
    expect((await livePayments(b.id)).map((r) => r.status)).toEqual([
      'succeeded',
      'succeeded',
      'succeeded',
    ])
    expect(await reload(b.id)).toMatchObject({ status: 'confirmed' })
    expect((await db.select().from(ledgerEntries)).map((l) => l.amount)).toEqual([1500, 1500, 1500])
    const confirmed = notifications.filter((n) => n.type === 'payment_confirmed')
    expect(confirmed).toHaveLength(1)
    expect(confirmed[0]!.params).toMatchObject({ amount: 4500, seats: 3 })
    // повтор — 409, без новых денег
    await expect(paymentService.confirm(owner(), b.paymentId!, { orgId })).rejects.toMatchObject({
      code: 'payment.not_pending',
    })
    expect(await db.select().from(ledgerEntries)).toHaveLength(3)
    expect(await readEventPricing({ userId: p }, ev.id)).toMatchObject({
      myPaymentStatus: 'succeeded',
      participantCount: 3,
    })
  })

  it('reject removes only unpaid seats when some are paid, and gives them to the queue', async () => {
    const ev = await makeEvent({ capacity: 3 })
    const p = await player()
    const waiting = await player()
    const b = await bookingService.book({ userId: p }, orgId, ev.id, { method: 'cash', seats: 2 })
    await paymentService.confirm(owner(), b.paymentId!, { orgId })
    const grown = await bookingService.changeSeats({ userId: p }, b.id, { seats: 3 })
    expect(grown.booking).toMatchObject({ status: 'pending_payment', seats: 3 })
    expect(await readEventPricing({ userId: p }, ev.id)).toMatchObject({
      myPaymentStatus: 'pending',
    })
    const w = await bookingService.book({ userId: waiting }, orgId, ev.id, { method: 'cash' })
    expect(w.status).toBe('waitlisted')

    const pendingRow = (await paymentService.listPending(owner(), orgId))[0]!
    expect(pendingRow).toMatchObject({ seats: 1, amount: 1500 })
    const notifications: PendingNotification[] = []
    await paymentService.cancel({ ...owner(), notifications }, pendingRow.id, { orgId })
    expect(await reload(b.id)).toMatchObject({ status: 'confirmed', seats: 2 })
    expect(notifications.find((n) => n.type === 'payment_rejected')!.params).toMatchObject({
      keptSeats: 2,
    })
    expect(await reload(w.id)).toMatchObject({ status: 'pending_payment', seats: 1 })
  })

  it('reject without paid seats cancels the whole booking (6.8.4)', async () => {
    const ev = await makeEvent()
    const p = await player()
    const b = await bookingService.book({ userId: p }, orgId, ev.id, { method: 'cash', seats: 2 })
    await paymentService.cancel(owner(), b.paymentId!, { orgId })
    expect(await reload(b.id)).toMatchObject({ status: 'cancelled' })
    expect((await livePayments(b.id)).map((r) => r.status)).toEqual(['cancelled', 'cancelled'])
  })

  it('partial cancel: unpaid seats first, then the latest paid seat is released without refund (D-14)', async () => {
    const ev = await makeEvent({ capacity: 4 })
    const p = await player()
    const waiting = await player()
    const b = await bookingService.book({ userId: p }, orgId, ev.id, { method: 'cash', seats: 2 })
    await paymentService.confirm(owner(), b.paymentId!, { orgId })
    await bookingService.changeSeats({ userId: p }, b.id, { seats: 4 })
    const queued = await bookingService.book({ userId: waiting }, orgId, ev.id, {
      method: 'cash',
      seats: 3,
    })
    expect(queued.status).toBe('waitlisted')

    // 4 → 3: снимается самое позднее неоплаченное место
    await bookingService.changeSeats({ userId: p }, b.id, { seats: 3 })
    let rows = await livePayments(b.id)
    expect(rows.map((r) => [r.status, r.seatReleasedAt !== null])).toEqual([
      ['succeeded', false],
      ['succeeded', false],
      ['pending', false],
      ['cancelled', false],
    ])
    // 3 → 1: последнее неоплаченное, затем самое позднее оплаченное (освобождено, не возвращено)
    const result = await bookingService.changeSeats({ userId: p }, b.id, { seats: 1 })
    rows = await livePayments(b.id)
    expect(rows.map((r) => [r.status, r.seatReleasedAt !== null])).toEqual([
      ['succeeded', false],
      ['succeeded', true],
      ['cancelled', false],
      ['cancelled', false],
    ])
    expect(result.booking).toMatchObject({ status: 'confirmed', seats: 1, paymentId: rows[0]!.id })
    const ledger = await db.select().from(ledgerEntries)
    expect(ledger.map((l) => [l.type, l.amount])).toEqual([
      ['income', 1500],
      ['income', 1500],
    ])
    // освобождённые места ушли первому в очереди: 3 свободных → вся очередь
    expect(await reload(queued.id)).toMatchObject({
      status: 'pending_payment',
      seats: 3,
      waitlistSeats: 0,
    })
    // освобождённое оплаченное место можно вернуть явной операцией организатора
    await paymentService.refund(owner(), rows[1]!.id, 'Возврат')
    expect((await livePayments(b.id))[1]).toMatchObject({ status: 'refunded' })
  })

  it('freed seats go to the first in the queue, partially, then to the next', async () => {
    const ev = await makeEvent({ capacity: 3, price: 0 })
    const a = await player()
    const b = await player()
    const c = await player()
    const big = await bookingService.book({ userId: a }, orgId, ev.id, { method: 'free', seats: 3 })
    const first = await bookingService.book({ userId: b }, orgId, ev.id, {
      method: 'free',
      seats: 2,
    })
    const second = await bookingService.book({ userId: c }, orgId, ev.id, { method: 'free' })
    expect([first.status, second.status]).toEqual(['waitlisted', 'waitlisted'])

    await bookingService.changeSeats({ userId: a }, big.id, { seats: 2 })
    expect(await reload(first.id)).toMatchObject({
      status: 'confirmed',
      seats: 1,
      waitlistSeats: 1,
    })
    expect(await reload(second.id)).toMatchObject({ status: 'waitlisted' })

    await bookingService.changeSeats({ userId: a }, big.id, { seats: 1 })
    expect(await reload(first.id)).toMatchObject({
      status: 'confirmed',
      seats: 2,
      waitlistSeats: 0,
    })
    expect(await reload(second.id)).toMatchObject({ status: 'waitlisted' })

    await bookingService.cancel({ userId: a }, big.id)
    expect(await reload(second.id)).toMatchObject({ status: 'confirmed', seats: 1 })
  })

  it('increasing seats never jumps the queue and needs free seats', async () => {
    const ev = await makeEvent({ capacity: 4 })
    const a = await player()
    const b = await player()
    const x = await player()
    const mine = await bookingService.book({ userId: a }, orgId, ev.id, {
      method: 'cash',
      seats: 2,
    })
    await bookingService.book({ userId: x }, orgId, ev.id, { method: 'cash' })
    await expect(
      bookingService.changeSeats({ userId: a }, mine.id, { seats: 4 }),
    ).rejects.toMatchObject({ code: 'booking.not_enough_seats', freeSeats: 1 })
    const queued = await bookingService.book({ userId: b }, orgId, ev.id, {
      method: 'cash',
      seats: 2,
      allowWaitlist: true,
    })
    expect(queued).toMatchObject({ seats: 1, waitlistSeats: 1 })
    await expect(
      bookingService.changeSeats({ userId: b }, queued.id, { seats: 3 }),
    ).rejects.toMatchObject({ code: 'booking.not_enough_seats' })
    // чужая запись своей группы — 403-код, без изменений
    await expect(
      bookingService.changeSeats({ userId: b }, mine.id, { seats: 1 }),
    ).rejects.toMatchObject({ code: 'booking.cannot_cancel_others' })
    expect(await reload(mine.id)).toMatchObject({ seats: 2 })
  })

  it('subscription: one session per seat from one subscription, restored on partial cancel', async () => {
    const ev = await makeEvent()
    const p = await player()
    const plan = await planService.create(owner(), {
      organizationId: orgId,
      name: 'Абонемент',
      totalSessions: 4,
    })
    const sub = await subscriptionService.createFromPlan({ userId: p }, orgId, plan.id, {
      autoActivate: true,
    })
    await expect(
      bookingService.book({ userId: p }, orgId, ev.id, {
        method: 'subscription',
        subscriptionId: sub.id,
        seats: 6,
      }),
    ).rejects.toMatchObject({ code: 'booking.seats_over_limit' })
    const b = await bookingService.book({ userId: p }, orgId, ev.id, {
      method: 'subscription',
      seats: 3,
    })
    expect(b).toMatchObject({ status: 'confirmed', seats: 3, subscriptionId: sub.id })
    expect((await subscriptionService.getById({ userId: p }, sub.id)).usedSessions).toBe(3)
    await expect(
      bookingService.changeSeats({ userId: p }, b.id, { seats: 5 }),
    ).rejects.toMatchObject({ code: 'subscription.not_enough_sessions' })
    expect((await subscriptionService.getById({ userId: p }, sub.id)).usedSessions).toBe(3)
    await bookingService.changeSeats({ userId: p }, b.id, { seats: 1 })
    expect((await subscriptionService.getById({ userId: p }, sub.id)).usedSessions).toBe(1)
    await bookingService.cancel({ userId: p }, b.id)
    expect((await subscriptionService.getById({ userId: p }, sub.id)).usedSessions).toBe(0)

    const other = await makeEvent()
    await expect(
      bookingService.book({ userId: p }, orgId, other.id, { method: 'subscription', seats: 5 }),
    ).rejects.toMatchObject({ code: 'subscription.not_enough_sessions' })
  })

  it('cancel releases paid seats without refund and cancels unpaid ones; rebooking is a new incarnation', async () => {
    const ev = await makeEvent()
    const p = await player()
    const b = await bookingService.book({ userId: p }, orgId, ev.id, { method: 'cash', seats: 2 })
    await paymentService.confirm(owner(), b.paymentId!, { orgId })
    await bookingService.changeSeats({ userId: p }, b.id, { seats: 3 })
    await bookingService.cancel({ userId: p }, b.id)
    let rows = await livePayments(b.id)
    expect(rows.map((r) => [r.status, r.seatReleasedAt !== null])).toEqual([
      ['succeeded', true],
      ['succeeded', true],
      ['cancelled', false],
    ])
    expect((await db.select().from(ledgerEntries)).filter((l) => l.type === 'expense')).toEqual([])

    const again = await bookingService.book({ userId: p }, orgId, ev.id, { method: 'cash' })
    expect(again).toMatchObject({ id: b.id, incarnation: 2, seats: 1 })
    rows = await livePayments(b.id)
    expect(rows.at(-1)).toMatchObject({ bookingIncarnation: 2, status: 'pending' })
    expect(again.paymentId).toBe(rows.at(-1)!.id)
    const pending = await paymentService.listPending(owner(), orgId)
    expect(pending).toEqual([expect.objectContaining({ id: rows.at(-1)!.id, seats: 1 })])
  })

  it('event cancel refunds live paid seats, not seats released earlier by the player (fixed)', async () => {
    const ev = await makeEvent()
    const p = await player()
    const b = await bookingService.book({ userId: p }, orgId, ev.id, { method: 'cash', seats: 3 })
    await paymentService.confirm(owner(), b.paymentId!, { orgId })
    await bookingService.changeSeats({ userId: p }, b.id, { seats: 1 })
    await eventService.cancel(owner(), ev.id)
    const rows = await livePayments(b.id)
    expect(rows.map((r) => r.status)).toEqual(['refunded', 'succeeded', 'succeeded'])
    const refunds = (await db.select().from(ledgerEntries)).filter((l) => l.type === 'expense')
    expect(refunds.map((l) => l.paymentId)).toEqual([rows[0]!.id])
    expect(await reload(b.id)).toMatchObject({ status: 'cancelled', waitlistSeats: 0 })
  })

  it('split: shares by seat units, participant count is seats, seats are final after settlement', async () => {
    vi.stubEnv('EVENT_SPLIT_PRICING_ENABLED', 'true')
    const ev = await eventService.create(owner(), orgId, {
      title: 'Сбор',
      startsAt: future(),
      endsAt: future(26),
      capacity: 6,
      priceMode: 'split',
      targetAmount: 1000,
    })
    const a = await player()
    const b = await player()
    const ba = await bookingService.book({ userId: a }, orgId, ev.id, { method: 'cash', seats: 2 })
    const bb = await bookingService.book({ userId: b }, orgId, ev.id, { method: 'cash' })
    expect(
      await readEventPriceQuote(
        { userId: a },
        { organizationId: orgId, eventId: ev.id, includeDrafts: false },
      ),
    ).toMatchObject({
      seats: 2,
    })
    const result = await eventPricingService.settle(owner(), orgId, ev.id)
    expect(result.summary).toMatchObject({ participantCount: 3, targetAmount: 1000 })
    expect(await reload(ba.id)).toMatchObject({ allocatedAmount: 667 })
    expect(await reload(bb.id)).toMatchObject({ allocatedAmount: 333 })
    const all = await db
      .select()
      .from(payments)
      .where(and(eq(payments.organizationId, orgId)))
    expect(all.map((p) => p.amount).sort()).toEqual([333, 667])
    await expect(
      bookingService.changeSeats({ userId: a }, ba.id, { seats: 1 }),
    ).rejects.toMatchObject({ code: 'booking.not_cancellable' })
  })

  it('queued seats on a subscription without sessions fall back to cash and keep the queue order (owner 2026-10-14)', async () => {
    const ev = await makeEvent({ capacity: 3 })
    const x = await player()
    const b = await player()
    const c = await player()
    const d = await player()
    const plan = await planService.create(owner(), {
      organizationId: orgId,
      name: 'Два занятия',
      totalSessions: 2,
    })
    const sub = await subscriptionService.createFromPlan({ userId: b }, orgId, plan.id, {
      autoActivate: true,
    })
    const bx = await bookingService.book({ userId: x }, orgId, ev.id, { method: 'cash' })
    const bb = await bookingService.book({ userId: b }, orgId, ev.id, {
      method: 'subscription',
      seats: 3,
      allowWaitlist: true,
    })
    expect(bb).toMatchObject({ status: 'confirmed', seats: 2, waitlistSeats: 1 })
    expect((await subscriptionService.getById({ userId: b }, sub.id)).usedSessions).toBe(2)
    const bc = await bookingService.book({ userId: c }, orgId, ev.id, { method: 'cash' })
    expect(bc.status).toBe('waitlisted')

    // освободилось место: первая в очереди — очередная часть записи b; занятий нет → наличные
    await bookingService.cancel({ userId: x }, bx.id)
    expect(await reload(bb.id)).toMatchObject({
      status: 'pending_payment',
      seats: 3,
      waitlistSeats: 0,
      method: 'subscription',
    })
    const cash = await livePayments(bb.id)
    expect(cash.map((p) => [p.status, p.amount, p.method])).toEqual([['pending', 1500, 'cash']])
    expect(await reload(bc.id)).toMatchObject({ status: 'waitlisted' })
    // новичок не занимает место впереди: свободных мест нет, он встаёт в очередь после c
    const bd = await bookingService.book({ userId: d }, orgId, ev.id, { method: 'cash' })
    expect(bd.status).toBe('waitlisted')

    // оплата наличного места подтверждает запись; частичная отмена: сначала наличное неоплаченное
    // нет — оно оплачено; затем места абонемента (занятие возвращается)
    await paymentService.confirm(owner(), cash[0]!.id, { orgId })
    expect(await reload(bb.id)).toMatchObject({ status: 'confirmed' })
    await bookingService.changeSeats({ userId: b }, bb.id, { seats: 2 })
    expect((await subscriptionService.getById({ userId: b }, sub.id)).usedSessions).toBe(1)
    expect((await livePayments(bb.id))[0]).toMatchObject({
      status: 'succeeded',
      seatReleasedAt: null,
    })
    expect(await reload(bc.id)).toMatchObject({ status: 'pending_payment', seats: 1 })

    // отмена записи: оставшееся занятие возвращается, оплаченное наличное место освобождается (D-14)
    await bookingService.cancel({ userId: b }, bb.id)
    expect((await subscriptionService.getById({ userId: b }, sub.id)).usedSessions).toBe(0)
    expect((await livePayments(bb.id))[0]!.seatReleasedAt).not.toBeNull()
    expect(await reload(bd.id)).toMatchObject({ status: 'pending_payment', seats: 1 })
  })

  describe('reject of the cash part of a mixed subscription + cash booking (review PR #126)', () => {
    // 5 занятий: 3 уже потрачены на другое событие, 2 — на места основы записи b (исчерпан);
    // очередные места b при продвижении оплачиваются наличными (решение владельца C)
    async function mixed(cashSeats: number) {
      const other = await makeEvent()
      const ev = await makeEvent({ capacity: 2 + cashSeats })
      const b = await player()
      const plan = await planService.create(owner(), {
        organizationId: orgId,
        name: 'Пять занятий',
        totalSessions: 5,
      })
      const sub = await subscriptionService.createFromPlan({ userId: b }, orgId, plan.id, {
        autoActivate: true,
      })
      await bookingService.book({ userId: b }, orgId, other.id, {
        method: 'subscription',
        seats: 3,
      })
      const holders: { userId: number; id: number }[] = []
      for (let i = 0; i < cashSeats; i += 1) {
        const userId = await player()
        holders.push({
          userId,
          id: (await bookingService.book({ userId }, orgId, ev.id, { method: 'cash' })).id,
        })
      }
      const bb = await bookingService.book({ userId: b }, orgId, ev.id, {
        method: 'subscription',
        seats: 2 + cashSeats,
        allowWaitlist: true,
      })
      expect(bb).toMatchObject({ status: 'confirmed', seats: 2, waitlistSeats: cashSeats })
      const used = async () =>
        (await subscriptionService.getById({ userId: b }, sub.id)).usedSessions
      expect(await used()).toBe(5)
      return { bb, holders, used }
    }

    it('2 subscription seats + 1 pending cash: reject keeps the 2 paid seats, returns no session', async () => {
      const { bb, holders, used } = await mixed(1)
      await bookingService.cancel({ userId: holders[0]!.userId }, holders[0]!.id)
      expect(await reload(bb.id)).toMatchObject({ status: 'pending_payment', seats: 3 })
      const [cash] = await livePayments(bb.id)
      const notifications: PendingNotification[] = []
      await paymentService.cancel({ ...owner(), notifications }, cash!.id, { orgId })
      expect(await reload(bb.id)).toMatchObject({
        status: 'confirmed',
        seats: 2,
        waitlistSeats: 0,
        paymentId: null,
      })
      expect(await used()).toBe(5)
      expect((await livePayments(bb.id)).map((p) => p.status)).toEqual(['cancelled'])
      expect(notifications.find((n) => n.type === 'payment_rejected')!.params).toMatchObject({
        keptSeats: 2,
      })
    })

    it('2 subscription seats + 1 paid cash + 1 pending cash: reject keeps 3 seats, returns no session', async () => {
      const { bb, holders, used } = await mixed(2)
      await bookingService.cancel({ userId: holders[0]!.userId }, holders[0]!.id)
      const [paid] = await livePayments(bb.id)
      await paymentService.confirm(owner(), paid!.id, { orgId })
      expect(await reload(bb.id)).toMatchObject({ status: 'confirmed', seats: 3 })
      await bookingService.cancel({ userId: holders[1]!.userId }, holders[1]!.id)
      expect(await reload(bb.id)).toMatchObject({ status: 'pending_payment', seats: 4 })
      const pending = (await livePayments(bb.id)).find((p) => p.status === 'pending')!
      await paymentService.cancel(owner(), pending.id, { orgId })
      expect(await reload(bb.id)).toMatchObject({
        status: 'confirmed',
        seats: 3,
        paymentId: paid!.id,
      })
      expect(await used()).toBe(5)
      expect((await livePayments(bb.id)).map((p) => [p.status, p.seatReleasedAt])).toEqual([
        ['succeeded', null],
        ['cancelled', null],
      ])
    })
  })

  it('reject of a subscription booking whose seats are all pending cash returns no session (hardening)', async () => {
    const other = await makeEvent()
    const ev = await makeEvent()
    const p = await player()
    const plan = await planService.create(owner(), {
      organizationId: orgId,
      name: 'Пять занятий',
      totalSessions: 5,
    })
    const sub = await subscriptionService.createFromPlan({ userId: p }, orgId, plan.id, {
      autoActivate: true,
    })
    await bookingService.book({ userId: p }, orgId, other.id, { method: 'subscription', seats: 4 })
    // состояние собрано напрямую: запись на абонементе, все места которой — неоплаченные наличные
    const [b] = await db
      .insert(bookings)
      .values({
        eventId: ev.id,
        userId: p,
        organizationId: orgId,
        status: 'pending_payment',
        method: 'subscription',
        subscriptionId: sub.id,
        seats: 2,
      })
      .returning()
    const cash = await db
      .insert(payments)
      .values(
        [0, 1].map(() => ({
          organizationId: orgId,
          userId: p,
          bookingId: b!.id,
          bookingIncarnation: b!.incarnation,
          amount: 1500,
          method: 'cash' as const,
          status: 'pending' as const,
        })),
      )
      .returning()
    await paymentService.cancel(owner(), cash[0]!.id, { orgId })
    expect(await reload(b!.id)).toMatchObject({ status: 'cancelled' })
    expect((await livePayments(b!.id)).map((x) => x.status)).toEqual(['cancelled', 'cancelled'])
    expect((await subscriptionService.getById({ userId: p }, sub.id)).usedSessions).toBe(4)
  })

  it('adding unpaid seats keeps the confirmation time of the booking', async () => {
    const ev = await makeEvent()
    const p = await player()
    const b = await bookingService.book({ userId: p }, orgId, ev.id, { method: 'cash', seats: 2 })
    await paymentService.confirm(owner(), b.paymentId!, { orgId })
    const confirmedAt = (await reload(b.id)).confirmedAt
    expect(confirmedAt).not.toBeNull()
    await bookingService.changeSeats({ userId: p }, b.id, { seats: 3 })
    expect(await reload(b.id)).toMatchObject({ status: 'pending_payment', confirmedAt })
  })

  it('split settlement releases queued seats of partial bookings', async () => {
    vi.stubEnv('EVENT_SPLIT_PRICING_ENABLED', 'true')
    const ev = await eventService.create(owner(), orgId, {
      title: 'Сбор',
      startsAt: future(),
      endsAt: future(26),
      capacity: 3,
      priceMode: 'split',
      targetAmount: 900,
    })
    const a = await player()
    const b = await player()
    await bookingService.book({ userId: a }, orgId, ev.id, { method: 'cash', seats: 2 })
    const bb = await bookingService.book({ userId: b }, orgId, ev.id, {
      method: 'cash',
      seats: 2,
      allowWaitlist: true,
    })
    expect(bb).toMatchObject({ seats: 1, waitlistSeats: 1 })
    await eventPricingService.settle(owner(), orgId, ev.id)
    expect(await reload(bb.id)).toMatchObject({ seats: 1, waitlistSeats: 0, allocatedAmount: 300 })
    expect((await eventService.statsFor({ userId: b }, [ev.id])).get(ev.id)).toMatchObject({
      taken: 3,
      waitlist: 0,
    })
  })
})
