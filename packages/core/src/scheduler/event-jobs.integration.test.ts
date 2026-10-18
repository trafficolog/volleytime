import {
  bookings,
  closeDb,
  db,
  eq,
  eventBalanceEntries,
  events,
  organizations,
  payments,
  scheduledJobs,
  sql,
  users,
  waitlistOffers,
} from '@volley-time/db'
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { behindEventLock } from '../__tests__/event-lock-barrier'
import { auditService } from '../audit/service'
import { offerFreeSeatsSweep } from '../bookings/offers'
import { bookingService } from '../bookings/service'
import { eventService } from '../events/service'
import { memberService } from '../members/service'
import { setNotifierTransport } from '../notifier/service'
import type { NotifyPayload } from '../notifier/types'
import { organizationService } from '../organizations/service'
import { seriesService } from '../series/service'

import { enqueueNotification, processDueJobs, purgeCompletedJobs } from './journal'
import { runSchedulerTick } from './tick'

/**
 * Task 20.3.1 (P-04): фоновые задачи события на реальном PostgreSQL. Время — фальшивый `Date`
 * (`vi.useFakeTimers({ toFake: ['Date'] })`), задачи вызываются напрямую (`runSchedulerTick`),
 * без реального ожидания. Гонки — через advisory-lock события (`behindEventLock`).
 */
describe('event jobs (20.3.1, PostgreSQL)', { timeout: 60_000 }, () => {
  const H = 3600_000
  const MIN = 60_000
  /** База времени теста: старт события = BASE + 48 ч. */
  let BASE: number
  let ownerId: number
  let orgId: number
  let sent: NotifyPayload[]
  let transportDown: boolean

  const at = (ms: number) => vi.setSystemTime(new Date(BASE + ms))
  const tick = () => runSchedulerTick({ now: new Date() })

  async function players(n: number): Promise<number[]> {
    const rows = await db
      .insert(users)
      .values(
        Array.from({ length: n }, (_, i) => ({
          email: `ej-${crypto.randomUUID()}-${i}@t.by`,
          telegramUserId: BigInt(Math.floor(Math.random() * 1e12)),
        })),
      )
      .returning()
    for (const u of rows)
      await memberService.add({ userId: ownerId }, { organizationId: orgId, userId: u.id })
    return rows.map((u) => u.id)
  }

  const makeEvent = (
    input: Partial<Parameters<typeof eventService.create>[2]> & { capacity: number },
  ) =>
    eventService.create({ userId: ownerId }, orgId, {
      title: 'Игра',
      startsAt: new Date(BASE + 48 * H),
      endsAt: new Date(BASE + 50 * H),
      price: 1000,
      ...input,
    })

  const offersOf = (eventId: number) =>
    db
      .select()
      .from(waitlistOffers)
      .where(eq(waitlistOffers.eventId, eventId))
      .orderBy(waitlistOffers.id)
  const bookingOf = async (id: number) =>
    (await db.query.bookings.findFirst({ where: eq(bookings.id, id) }))!
  const sentTo = async (userId: number) => {
    const u = await db.query.users.findFirst({ where: eq(users.id, userId) })
    return sent.filter((p) => p.telegramId === String(u!.telegramUserId))
  }

  beforeEach(async () => {
    BASE = Math.floor(Date.now() / MIN) * MIN
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(BASE))
    vi.stubEnv('SCHEDULER_ENABLED', 'true')
    vi.stubEnv('NUXT_PUBLIC_WEB_URL', 'http://localhost:3000')
    sent = []
    transportDown = false
    setNotifierTransport({
      async send(payload) {
        if (transportDown) throw new Error('bot unavailable')
        sent.push(payload)
      },
    })
    await db.delete(scheduledJobs)
    await db.delete(organizations)
    await db.delete(users)
    const [u] = await db
      .insert(users)
      .values({ email: `ej-owner-${crypto.randomUUID()}@t.by` })
      .returning()
    ownerId = u!.id
    orgId = (await organizationService.create({ userId: ownerId }, { name: 'Jobs' })).id
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllEnvs()
    setNotifierTransport({ async send() {} })
  })

  afterAll(async () => {
    await db.delete(scheduledJobs)
    await db.delete(organizations)
    await db.delete(users)
    await closeDb()
  })

  describe('booking opening time (D-09)', () => {
    it('rejects bookings before booking_opens_at and accepts them after', async () => {
      const [p] = await players(1)
      const ev = await makeEvent({ capacity: 4, bookingOpensAt: new Date(BASE + 10 * H) })
      expect(ev.bookingOpensAt).toEqual(new Date(BASE + 10 * H))
      await expect(
        bookingService.book({ userId: p! }, orgId, ev.id, { method: 'cash' }),
      ).rejects.toMatchObject({ code: 'booking.not_open_yet' })
      at(10 * H)
      const b = await bookingService.book({ userId: p! }, orgId, ev.id, { method: 'cash' })
      expect(b.status).toBe('pending_payment')
    })

    it('requires the scheduler capability and an opening time before the start', async () => {
      vi.stubEnv('SCHEDULER_ENABLED', '')
      await expect(
        makeEvent({ capacity: 4, bookingOpensAt: new Date(BASE + 10 * H) }),
      ).rejects.toMatchObject({ code: 'event.scheduler_disabled' })
      vi.stubEnv('SCHEDULER_ENABLED', 'true')
      // открытие = начало и открытие внутри окна закрытия (начало − 2 ч) — 422 (ревью PR #150, I1)
      await expect(
        makeEvent({ capacity: 4, bookingOpensAt: new Date(BASE + 48 * H) }),
      ).rejects.toMatchObject({ code: 'event.booking_opens_after_close' })
      await expect(
        makeEvent({ capacity: 4, bookingOpensAt: new Date(BASE + 46 * H + 1) }),
      ).rejects.toMatchObject({ code: 'event.booking_opens_after_close' })
      await expect(
        makeEvent({
          capacity: 4,
          closeBeforeMinutes: 1440,
          bookingOpensAt: new Date(BASE + 30 * H),
        }),
      ).rejects.toMatchObject({ code: 'event.booking_opens_after_close' })
      const ok = await makeEvent({ capacity: 4, bookingOpensAt: new Date(BASE + 46 * H) })
      expect(ok.closeBeforeMinutes).toBe(120)
      // срок закрытия — только 1/2/6/24 ч (422 валидации на HTTP)
      await expect(
        makeEvent({ capacity: 4, closeBeforeMinutes: 90 as never }),
      ).rejects.toMatchObject({ name: 'ZodError' })
      await expect(
        makeEvent({ capacity: 4, bookingOpensAt: new Date(BASE - H) }),
      ).rejects.toMatchObject({ code: 'event.booking_opens_in_past' })
      // перенос начала раньше ещё не наступившего открытия (с учётом срока закрытия) — 422
      const opening = await makeEvent({ capacity: 4, bookingOpensAt: new Date(BASE + 10 * H) })
      await expect(
        eventService.update({ userId: ownerId }, opening.id, {
          startsAt: new Date(BASE + 11 * H),
          endsAt: new Date(BASE + 12 * H),
        }),
      ).rejects.toMatchObject({ code: 'event.booking_opens_after_close' })
      // будущее время открытия событию с записями — 409 (D-09/D-13)
      const [p] = await players(1)
      const open = await makeEvent({ capacity: 4, price: 0 })
      await bookingService.book({ userId: p! }, orgId, open.id, { method: 'free' })
      await expect(
        eventService.update({ userId: ownerId }, open.id, {
          bookingOpensAt: new Date(BASE + 5 * H),
        }),
      ).rejects.toMatchObject({ code: 'event.booking_already_open' })
    })

    it('does not announce booking opening for invite-only events', async () => {
      vi.stubEnv('EVENT_INVITE_MODE_ENABLED', 'true')
      await players(2)
      await makeEvent({
        capacity: 4,
        joinMode: 'invite',
        bookingOpensAt: new Date(BASE + 10 * H),
      })
      at(10 * H + MIN)
      await tick()
      expect(sent.filter((p) => p.text.includes('Запись открыта'))).toHaveLength(0)
    })

    it('notifies every active member once when booking opens', async () => {
      const ids = await players(3)
      const ev = await makeEvent({ capacity: 4, bookingOpensAt: new Date(BASE + 10 * H) })
      await tick()
      expect(sent).toHaveLength(0)
      at(10 * H + MIN)
      await tick()
      for (const id of ids) expect(await sentTo(id)).toHaveLength(1)
      const opened = sent.filter((p) => p.text.includes('Запись открыта'))
      expect(opened.length).toBe(sent.length)
      // повторный проход и параллельные проходы не дублируют
      const before = sent.length
      await Promise.all([tick(), tick()])
      expect(sent).toHaveLength(before)
      // отменённое событие не рассылает
      const ev2 = await makeEvent({ capacity: 4, bookingOpensAt: new Date(BASE + 12 * H) })
      await eventService.cancel({ userId: ownerId }, ev2.id)
      at(12 * H + MIN)
      await tick()
      expect(sent).toHaveLength(before)
      expect(ev.id).toBeGreaterThan(0)
    })

    it('refunds the event balance when the event is cancelled before booking opens', async () => {
      vi.stubEnv('EVENT_BALANCE_ENFORCED', 'true')
      const [p] = await players(1)
      const ev = await makeEvent({ capacity: 4, bookingOpensAt: new Date(BASE + 10 * H) })
      // запись, существующая до открытия (например, сохранённая прежним runtime), возврат не блокирует
      await db.insert(bookings).values({
        eventId: ev.id,
        userId: p!,
        organizationId: orgId,
        status: 'confirmed',
        method: 'free',
      })
      await eventService.cancel({ userId: ownerId }, ev.id)
      const entries = await db
        .select()
        .from(eventBalanceEntries)
        .where(eq(eventBalanceEntries.eventId, ev.id))
      expect(entries.map((e) => e.reason).sort()).toEqual(['refund', 'spend'])
    })
  })

  describe('waitlist offers with TTL (D-03)', () => {
    async function fullEvent(capacity = 1) {
      const ev = await makeEvent({ capacity, price: 0 })
      const [a, b, c] = await players(3)
      const ba = await bookingService.book({ userId: a! }, orgId, ev.id, { method: 'free' })
      const bb = await bookingService.book({ userId: b! }, orgId, ev.id, { method: 'free' })
      const bc = await bookingService.book({ userId: c! }, orgId, ev.id, { method: 'free' })
      expect([ba.status, bb.status, bc.status]).toEqual(['confirmed', 'waitlisted', 'waitlisted'])
      return { ev, a: a!, b: b!, c: c!, ba, bb, bc }
    }

    it('offers a freed seat to the first in queue instead of auto-promoting', async () => {
      const { ev, ba, bb, bc, b } = await fullEvent()
      const { promoted } = await bookingService.cancel({ userId: ba.userId }, ba.id)
      expect(promoted).toBeNull()
      expect((await bookingOf(bb.id)).status).toBe('waitlisted')
      const offers = await offersOf(ev.id)
      expect(offers).toHaveLength(1)
      expect(offers[0]).toMatchObject({
        bookingId: bb.id,
        seats: 1,
        status: 'offered',
        expiresAt: new Date(BASE + 30 * MIN),
      })
      // место под предложением занято: новый игрок встаёт в очередь
      const [d] = await players(1)
      const bd = await bookingService.book({ userId: d! }, orgId, ev.id, { method: 'free' })
      expect(bd.status).toBe('waitlisted')
      // уведомление-предложение уходит в течение минуты (первый проход планировщика)
      at(20_000)
      await tick()
      expect(await sentTo(b)).toHaveLength(1)
      expect((await sentTo(b))[0]!.text).toContain('30 мин')
      expect(bc.status).toBe('waitlisted')
    })

    it('accepting the offer moves the seats into the roster exactly once', async () => {
      const { ev, ba, bb, b } = await fullEvent()
      await bookingService.cancel({ userId: ba.userId }, ba.id)
      const [offer] = await offersOf(ev.id)
      at(10 * MIN)
      const accepted = await bookingService.acceptWaitlistOffer({ userId: b }, offer!.id)
      expect(accepted.status).toBe('confirmed')
      // повтор принятия — идемпотентен
      const again = await bookingService.acceptWaitlistOffer({ userId: b }, offer!.id)
      expect(again.id).toBe(bb.id)
      expect((await offersOf(ev.id))[0]!.status).toBe('accepted')
      // чужое предложение не раскрывается
      await expect(
        bookingService.acceptWaitlistOffer({ userId: ownerId }, offer!.id),
      ).rejects.toMatchObject({ code: 'waitlist_offer.not_found' })
    })

    it('an expired offer is not accepted, leaves the queue and moves to the next player', async () => {
      const { ev, ba, bb, bc, b, c } = await fullEvent()
      await bookingService.cancel({ userId: ba.userId }, ba.id)
      const [offer] = await offersOf(ev.id)
      at(30 * MIN + 1)
      await expect(
        bookingService.acceptWaitlistOffer({ userId: b }, offer!.id),
      ).rejects.toMatchObject({ code: 'waitlist_offer.expired' })
      await tick()
      const offers = await offersOf(ev.id)
      expect(offers.map((o) => [o.bookingId, o.status])).toEqual([
        [bb.id, 'expired'],
        [bc.id, 'offered'],
      ])
      expect((await bookingOf(bb.id)).status).toBe('cancelled')
      expect(offers[1]!.expiresAt).toEqual(new Date(BASE + 60 * MIN + 1))
      // повторный проход не создаёт новых предложений и уведомлений
      const before = sent.length
      await tick()
      expect(await offersOf(ev.id)).toHaveLength(2)
      expect(sent).toHaveLength(before)
      expect((await sentTo(c)).some((p) => p.text.includes('30 мин'))).toBe(true)
      expect((await sentTo(b)).some((p) => p.text.includes('не подтвердили'))).toBe(true)
      // последний в очереди не отвечает — место остаётся свободным, без зацикливания
      at(61 * MIN)
      await tick()
      await tick()
      expect((await offersOf(ev.id)).map((o) => o.status)).toEqual(['expired', 'expired'])
      const [e] = await players(1)
      const be = await bookingService.book({ userId: e! }, orgId, ev.id, { method: 'free' })
      expect(be.status).toBe('confirmed')
    })

    it('cancelling a booking with an active offer revokes it and offers the seat onward', async () => {
      const { ev, ba, bb, bc, b } = await fullEvent()
      await bookingService.cancel({ userId: ba.userId }, ba.id)
      await bookingService.cancel({ userId: b }, bb.id)
      const offers = await offersOf(ev.id)
      expect(offers.map((o) => [o.bookingId, o.status])).toEqual([
        [bb.id, 'revoked'],
        [bc.id, 'offered'],
      ])
    })

    it('event cancellation revokes active offers', async () => {
      const { ev, ba } = await fullEvent()
      await bookingService.cancel({ userId: ba.userId }, ba.id)
      await eventService.cancel({ userId: ownerId }, ev.id)
      expect((await offersOf(ev.id)).map((o) => o.status)).toEqual(['revoked'])
    })

    it('multi-seat: offers only free seats and keeps the rest of the queue', async () => {
      vi.stubEnv('EVENT_MULTI_SEAT_ENABLED', 'true')
      await db
        .update(organizations)
        .set({ maxSeatsPerBooking: 4 })
        .where(eq(organizations.id, orgId))
      const ev = await makeEvent({ capacity: 3, price: 0 })
      const [a, b] = await players(2)
      const ba = await bookingService.book({ userId: a! }, orgId, ev.id, {
        method: 'free',
        seats: 2,
      })
      const bb = await bookingService.book({ userId: b! }, orgId, ev.id, {
        method: 'free',
        seats: 3,
        allowWaitlist: true,
      })
      expect(bb).toMatchObject({ status: 'confirmed', seats: 1, waitlistSeats: 2 })
      await bookingService.changeSeats({ userId: a! }, ba.id, { seats: 1 })
      const [offer] = await offersOf(ev.id)
      expect(offer).toMatchObject({ bookingId: bb.id, seats: 1, status: 'offered' })
      const accepted = await bookingService.acceptWaitlistOffer({ userId: b! }, offer!.id)
      expect(accepted).toMatchObject({ seats: 2, waitlistSeats: 1 })
    })

    it('accept and expiry racing on the event lock produce exactly one outcome', async () => {
      const { ev, ba, bb, b } = await fullEvent()
      await bookingService.cancel({ userId: ba.userId }, ba.id)
      const [offer] = await offersOf(ev.id)
      // принятие встаёт в очередь первым — успевает до истечения
      at(30 * MIN - 1)
      const results = await behindEventLock(ev.id, [
        () => bookingService.acceptWaitlistOffer({ userId: b }, offer!.id),
        () => runSchedulerTick({ now: new Date(BASE + 31 * MIN) }),
      ])
      expect(results.map((r) => r.status)).toEqual(['fulfilled', 'fulfilled'])
      expect((await offersOf(ev.id)).map((o) => o.status)).toEqual(['accepted'])
      expect((await bookingOf(bb.id)).status).toBe('confirmed')
    })

    it('expiry first: a racing accept is refused and the seat goes to the next player', async () => {
      const { ev, ba, bc, b } = await fullEvent()
      await bookingService.cancel({ userId: ba.userId }, ba.id)
      const [offer] = await offersOf(ev.id)
      at(31 * MIN)
      const results = await behindEventLock(ev.id, [
        () => runSchedulerTick({ now: new Date(BASE + 31 * MIN) }),
        () => bookingService.acceptWaitlistOffer({ userId: b }, offer!.id),
      ])
      expect(results[0]!.status).toBe('fulfilled')
      expect(results[1]).toMatchObject({
        status: 'rejected',
        reason: expect.objectContaining({ code: 'waitlist_offer.expired' }),
      })
      expect((await offersOf(ev.id)).map((o) => [o.bookingId, o.status])).toEqual([
        [offer!.bookingId, 'expired'],
        [bc.id, 'offered'],
      ])
    })

    it('an expired but unprocessed offer no longer holds its seats: they go to the queue head', async () => {
      const { ev, ba, bb, bc } = await fullEvent()
      await bookingService.cancel({ userId: ba.userId }, ba.id)
      at(31 * MIN) // истекло, проход планировщика ещё не был
      const [d] = await players(1)
      const bd = await bookingService.book({ userId: d! }, orgId, ev.id, { method: 'free' })
      // истёкшее предложение закрыто под lock записи, место предложено следующему в очереди
      expect(bd.status).toBe('waitlisted')
      expect((await offersOf(ev.id)).map((o) => [o.bookingId, o.status])).toEqual([
        [bb.id, 'expired'],
        [bc.id, 'offered'],
      ])
      // очередь пуста — место свободно для новичка
      await bookingService.cancel({ userId: bc.userId }, bc.id)
      await bookingService.cancel({ userId: bd.userId }, bd.id)
      const [e] = await players(1)
      const be = await bookingService.book({ userId: e! }, orgId, ev.id, { method: 'free' })
      expect(be.status).toBe('confirmed')
    })

    it('reducing seats keeps an offer that still fits the queue: no new TTL, no new message', async () => {
      vi.stubEnv('EVENT_MULTI_SEAT_ENABLED', 'true')
      await db
        .update(organizations)
        .set({ maxSeatsPerBooking: 4 })
        .where(eq(organizations.id, orgId))
      const ev = await makeEvent({ capacity: 4, price: 0 })
      const [a, b, c] = await players(3)
      const ba = await bookingService.book({ userId: a! }, orgId, ev.id, { method: 'free' })
      await bookingService.book({ userId: c! }, orgId, ev.id, { method: 'free' })
      const bb = await bookingService.book({ userId: b! }, orgId, ev.id, {
        method: 'free',
        seats: 4,
        allowWaitlist: true,
      })
      expect(bb).toMatchObject({ seats: 2, waitlistSeats: 2 })
      await bookingService.cancel({ userId: a! }, ba.id)
      const [offer] = await offersOf(ev.id)
      expect(offer).toMatchObject({ bookingId: bb.id, seats: 1, status: 'offered' })
      at(5 * MIN)
      await bookingService.changeSeats({ userId: b! }, bb.id, { seats: 3 }) // очередь 2 → 1
      expect(await offersOf(ev.id)).toEqual([offer])
      await bookingService.changeSeats({ userId: b! }, bb.id, { seats: 2 }) // очередь 1 → 0
      expect((await offersOf(ev.id)).map((o) => o.status)).toEqual(['revoked'])
    })

    it('flag on → offer → flag off: legacy promotion skips the offer holder, stale offers expire lazily', async () => {
      const ev = await makeEvent({ capacity: 2, price: 0 })
      const [a, b, c, d, e] = await players(5)
      const ba = await bookingService.book({ userId: a! }, orgId, ev.id, { method: 'free' })
      const bb = await bookingService.book({ userId: b! }, orgId, ev.id, { method: 'free' })
      const bc = await bookingService.book({ userId: c! }, orgId, ev.id, { method: 'free' })
      const bd = await bookingService.book({ userId: d! }, orgId, ev.id, { method: 'free' })
      await bookingService.cancel({ userId: a! }, ba.id) // предложение c
      vi.stubEnv('SCHEDULER_ENABLED', '')
      const { promoted } = await bookingService.cancel({ userId: b! }, bb.id)
      // c держит действующее предложение — продвигается следующий, d
      expect(promoted?.id).toBe(bd.id)
      expect((await bookingOf(bc.id)).status).toBe('waitlisted')
      expect((await offersOf(ev.id)).map((o) => o.status)).toEqual(['offered'])
      // c не ответил; после срока освобождение места лениво закрывает предложение
      const be = await bookingService.book({ userId: e! }, orgId, ev.id, { method: 'free' })
      expect(be.status).toBe('waitlisted')
      at(31 * MIN)
      await bookingService.cancel({ userId: d! }, bd.id)
      expect((await offersOf(ev.id)).map((o) => o.status)).toEqual(['expired'])
      expect((await bookingOf(bc.id)).status).toBe('cancelled')
      expect((await bookingOf(be.id)).status).toBe('confirmed')
    })

    it('a newcomer does not take a free seat ahead of the queue', async () => {
      const { ev, bb } = await fullEvent()
      // место освободилось без отмены (вместимость увеличена) — предложения ещё нет
      await eventService.update({ userId: ownerId }, ev.id, { capacity: 2 })
      expect(await offersOf(ev.id)).toHaveLength(0)
      const [d] = await players(1)
      const bd = await bookingService.book({ userId: d! }, orgId, ev.id, { method: 'free' })
      expect(bd.status).toBe('waitlisted')
      expect((await offersOf(ev.id)).map((o) => [o.bookingId, o.status])).toEqual([
        [bb.id, 'offered'],
      ])
    })

    it('the offer sweep does nothing with the scheduler off', async () => {
      const { ev } = await fullEvent()
      await eventService.update({ userId: ownerId }, ev.id, { capacity: 2 })
      vi.stubEnv('SCHEDULER_ENABLED', '')
      expect(await offerFreeSeatsSweep(new Date())).toBe(0)
      expect(await offersOf(ev.id)).toHaveLength(0)
    })

    it('the tick offers seats freed without a trigger to the queue', async () => {
      const { ev, bb } = await fullEvent()
      await eventService.update({ userId: ownerId }, ev.id, { capacity: 2 })
      expect(await offersOf(ev.id)).toHaveLength(0)
      await tick()
      expect((await offersOf(ev.id)).map((o) => [o.bookingId, o.status])).toEqual([
        [bb.id, 'offered'],
      ])
      await tick()
      expect(await offersOf(ev.id)).toHaveLength(1)
    })

    it('without the scheduler the queue is auto-promoted as before (D-03)', async () => {
      vi.stubEnv('SCHEDULER_ENABLED', '')
      const { ev, ba, bb } = await fullEvent()
      const { promoted } = await bookingService.cancel({ userId: ba.userId }, ba.id)
      expect(promoted?.id).toBe(bb.id)
      expect(await offersOf(ev.id)).toHaveLength(0)
    })
  })

  describe('closing booking and split settlement', () => {
    it('closes a fixed event 2 h before start, blocks new bookings, keeps cancellation', async () => {
      const ev = await makeEvent({ capacity: 4 })
      const [a, b] = await players(2)
      const ba = await bookingService.book({ userId: a! }, orgId, ev.id, { method: 'cash' })
      at(46 * H - MIN)
      await tick()
      expect((await db.query.events.findFirst({ where: eq(events.id, ev.id) }))!.status).toBe(
        'published',
      )
      at(46 * H)
      await tick()
      expect((await db.query.events.findFirst({ where: eq(events.id, ev.id) }))!.status).toBe(
        'closed',
      )
      await expect(
        bookingService.book({ userId: b! }, orgId, ev.id, { method: 'cash' }),
      ).rejects.toMatchObject({ code: 'booking.event_not_bookable' })
      // отмена регулируется политикой группы (снимок D-02), а не закрытием записи
      await db.update(events).set({ cancellationDeadlineHours: 1 }).where(eq(events.id, ev.id))
      const { booking } = await bookingService.cancel({ userId: a! }, ba.id)
      expect(booking.status).toBe('cancelled')
    })

    it('settles split shares at close exactly once, also under parallel ticks', async () => {
      vi.stubEnv('EVENT_SPLIT_PRICING_ENABLED', 'true')
      const ev = await makeEvent({ capacity: 4, price: 0, priceMode: 'split', targetAmount: 1001 })
      const ids = await players(3)
      for (const id of ids)
        await bookingService.book({ userId: id }, orgId, ev.id, { method: 'cash' })
      at(46 * H)
      await Promise.all([tick(), tick(), tick()])
      const settled = (await db.query.events.findFirst({ where: eq(events.id, ev.id) }))!
      expect(settled).toMatchObject({ status: 'closed', pricingParticipantCount: 3 })
      const paid = await db.select().from(payments).where(eq(payments.organizationId, orgId))
      expect(paid.map((p) => p.amount).sort()).toEqual([333, 334, 334])
      await tick()
      await processDueJobs({ now: new Date() })
      expect(
        await db.select().from(payments).where(eq(payments.organizationId, orgId)),
      ).toHaveLength(3)
      // каждый участник получил итоговую долю один раз
      for (const id of ids)
        expect((await sentTo(id)).filter((p) => p.text.includes('закрыта'))).toHaveLength(1)
    })

    it('closes an empty split without settlement and never settles a late booking', async () => {
      vi.stubEnv('EVENT_SPLIT_PRICING_ENABLED', 'true')
      const ev = await makeEvent({ capacity: 4, price: 0, priceMode: 'split', targetAmount: 1001 })
      const [p, q] = await players(2)
      // момент закрытия наступил, прохода ещё не было: запись уже закрыта
      at(46 * H)
      await expect(
        bookingService.book({ userId: p! }, orgId, ev.id, { method: 'cash' }),
      ).rejects.toMatchObject({ code: 'booking.event_not_bookable' })
      // запись, попавшая после момента закрытия (например, при выключенном флаге), не фиксируется
      await db.insert(bookings).values({
        eventId: ev.id,
        userId: q!,
        organizationId: orgId,
        status: 'pending_payment',
        method: 'cash',
        bookedAt: new Date(BASE + 46 * H),
      })
      at(46 * H + MIN)
      await tick()
      const closed = (await db.query.events.findFirst({ where: eq(events.id, ev.id) }))!
      expect(closed).toMatchObject({ status: 'closed', pricingSettledAt: null })
      expect(
        await db.select().from(payments).where(eq(payments.organizationId, orgId)),
      ).toHaveLength(0)
      expect(
        (
          await bookingOf(
            (await db.select().from(bookings).where(eq(bookings.eventId, ev.id)))[0]!.id,
          )
        ).allocatedAmount,
      ).toBeNull()
    })

    it('series dates take the close time from the template and its edits', async () => {
      const startDate = new Date(BASE + 7 * 24 * H).toISOString().slice(0, 10)
      const { series } = await seriesService.create({ userId: ownerId }, orgId, {
        rule: {
          freq: 'weekly',
          weekdays: [new Date(`${startDate}T12:00:00Z`).getUTCDay() || 7],
          startDate,
          count: 2,
        },
        template: {
          title: 'Серия',
          startTime: '19:00',
          durationMinutes: 90,
          capacity: 10,
          closeBeforeMinutes: 360,
        },
        idempotencyKey: 'close-before-1',
      })
      const dates = await db.select().from(events).where(eq(events.seriesId, series.id))
      expect(dates.map((e) => e.closeBeforeMinutes)).toEqual([360, 360])
      await seriesService.update(
        { userId: ownerId },
        orgId,
        series.id,
        { scope: 'following', from: startDate },
        { closeBeforeMinutes: 60 },
      )
      const edited = await db.select().from(events).where(eq(events.seriesId, series.id))
      expect(edited.map((e) => e.closeBeforeMinutes)).toEqual([60, 60])
    })

    it('uses the per-event close time', async () => {
      const ev = await makeEvent({ capacity: 4, closeBeforeMinutes: 360 })
      at(42 * H - MIN)
      await tick()
      expect((await db.query.events.findFirst({ where: eq(events.id, ev.id) }))!.status).toBe(
        'published',
      )
      at(42 * H)
      await tick()
      expect((await db.query.events.findFirst({ where: eq(events.id, ev.id) }))!.status).toBe(
        'closed',
      )
    })

    it('does not auto-close events created, moved or reopened after their close moment', async () => {
      const [p] = await players(1)
      at(47 * H)
      // создано уже внутри окна закрытия (начало через 1 ч)
      const late = await eventService.create({ userId: ownerId }, orgId, {
        title: 'Поздно',
        startsAt: new Date(BASE + 48 * H),
        endsAt: new Date(BASE + 50 * H),
        capacity: 4,
      })
      at(0)
      // черновик перенесён в окно и опубликован там одним запросом: открыт после момента закрытия
      const moved = await makeEvent({ capacity: 4, price: 0, status: 'draft' })
      // переоткрыто после закрытия
      const reopened = await makeEvent({ capacity: 4, price: 0 })
      // опубликованное событие перенесено в окно — без отказа, запись ведёт организатор
      const shifted = await makeEvent({ capacity: 4, price: 0 })
      // смена срока закрытия на уже прошедший момент — так же
      const longer = await makeEvent({ capacity: 4, price: 0 })
      at(45 * H)
      await eventService.update({ userId: ownerId }, shifted.id, {
        startsAt: new Date(BASE + 46 * H + 30 * MIN),
        endsAt: new Date(BASE + 49 * H),
      })
      await eventService.update({ userId: ownerId }, longer.id, { closeBeforeMinutes: 360 })
      await eventService.update({ userId: ownerId }, moved.id, {
        status: 'published',
        startsAt: new Date(BASE + 46 * H + 30 * MIN),
        endsAt: new Date(BASE + 49 * H),
      })
      at(46 * H)
      await tick()
      expect((await db.query.events.findFirst({ where: eq(events.id, reopened.id) }))!.status).toBe(
        'closed',
      )
      at(46 * H + 10 * MIN)
      await eventService.update({ userId: ownerId }, reopened.id, { status: 'published' })
      at(46 * H + 20 * MIN)
      await tick()
      for (const id of [late.id, moved.id, reopened.id, shifted.id, longer.id])
        expect((await db.query.events.findFirst({ where: eq(events.id, id) }))!.status).toBe(
          'published',
        )
      // организатор ведёт такие события: запись открыта
      const b = await bookingService.book({ userId: p! }, orgId, late.id, { method: 'free' })
      expect(b.status).toBe('confirmed')
    })

    it('a marked last-minute event moved later is closed by schedule again', async () => {
      at(47 * H)
      const ev = await eventService.create({ userId: ownerId }, orgId, {
        title: 'Срочно',
        startsAt: new Date(BASE + 48 * H),
        endsAt: new Date(BASE + 50 * H),
        capacity: 4,
      })
      // перенос на следующий день: момент закрытия снова в будущем, метка снимается
      await eventService.update({ userId: ownerId }, ev.id, {
        startsAt: new Date(BASE + 72 * H),
        endsAt: new Date(BASE + 74 * H),
      })
      at(70 * H)
      await tick()
      expect((await db.query.events.findFirst({ where: eq(events.id, ev.id) }))!.status).toBe(
        'closed',
      )
    })

    it('with the scheduler off, moving an event into the window behaves as R0.7', async () => {
      vi.stubEnv('SCHEDULER_ENABLED', '')
      const ev = await makeEvent({ capacity: 4, price: 0 })
      const [p] = await players(1)
      at(45 * H)
      const moved = await eventService.update({ userId: ownerId }, ev.id, {
        startsAt: new Date(BASE + 46 * H + 30 * MIN),
        endsAt: new Date(BASE + 49 * H),
      })
      expect(moved.status).toBe('published')
      const b = await bookingService.book({ userId: p! }, orgId, ev.id, { method: 'free' })
      expect(b.status).toBe('confirmed')
    })

    it('a series edit on game day succeeds and leaves that date to the organizer', async () => {
      const startDate = new Date(BASE + 24 * H).toISOString().slice(0, 10)
      const weekday = new Date(`${startDate}T12:00:00Z`).getUTCDay() || 7
      const { series } = await seriesService.create({ userId: ownerId }, orgId, {
        rule: { freq: 'weekly', weekdays: [weekday], startDate, count: 2 },
        template: { title: 'Серия', startTime: '23:00', durationMinutes: 60, capacity: 10 },
        idempotencyKey: 'game-day-1',
      })
      const [first] = await db
        .select()
        .from(events)
        .where(eq(events.seriesId, series.id))
        .orderBy(events.startsAt)
      // день игры: до начала меньше срока закрытия после правки «это и последующие»
      vi.setSystemTime(new Date(first!.startsAt.getTime() - 3 * H))
      await seriesService.update(
        { userId: ownerId },
        orgId,
        series.id,
        { scope: 'following', from: startDate },
        { closeBeforeMinutes: 360 },
      )
      await tick()
      expect((await db.query.events.findFirst({ where: eq(events.id, first!.id) }))!.status).toBe(
        'published',
      )
    })

    it('stops retrying a transient close failure after the retry limit and alerts once', async () => {
      const ev = await makeEvent({ capacity: 4, price: 0 })
      const record = vi.spyOn(auditService, 'record').mockRejectedValue(new Error('timeout'))
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const errors = vi.spyOn(console, 'error').mockImplementation(() => {})
      at(46 * H)
      for (let i = 0; i < 7; i++) await tick()
      const alerts = errors.mock.calls.filter((c) => String(c[0]).includes('auto-close failed'))
      record.mockRestore()
      warn.mockRestore()
      errors.mockRestore()
      expect(alerts).toHaveLength(1)
      const jobs = await db.select().from(scheduledJobs).where(eq(scheduledJobs.eventId, ev.id))
      expect(jobs.find((j) => j.kind === 'event.close_retry')!.attempts).toBe(5)
      expect(jobs.filter((j) => j.kind === 'event.close_skipped')).toHaveLength(1)
    })

    it('a failed retry-counter write does not abort the rest of the close pass', async () => {
      const first = await makeEvent({ capacity: 4, price: 0 })
      const second = await makeEvent({
        capacity: 4,
        price: 0,
        startsAt: new Date(BASE + 48 * H + MIN),
      })
      const original = auditService.record.bind(auditService)
      const record = vi.spyOn(auditService, 'record').mockImplementation(async (ctx, params) => {
        if (params.entityId === first.id && params.action === 'event.booking_closed')
          throw new Error('connection terminated')
        return original(ctx, params)
      })
      const originalExecute = db.execute.bind(db)
      const execute = vi.spyOn(db, 'execute').mockImplementation(((query: unknown) => {
        const chunks = (query as { queryChunks?: unknown[] }).queryChunks ?? []
        const text = chunks
          .map((c) =>
            typeof c === 'string' ? c : ((c as { value?: string[] }).value ?? []).join(''),
          )
          .join(' ')
        if (text.includes('event.close_retry'))
          return Promise.reject(new Error('connection refused'))
        return originalExecute(query as never)
      }) as never)
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
      at(46 * H + 2 * MIN)
      await tick()
      record.mockRestore()
      execute.mockRestore()
      warn.mockRestore()
      const status = async (id: number) =>
        (await db.query.events.findFirst({ where: eq(events.id, id) }))!.status
      expect(await status(first.id)).toBe('published')
      expect(await status(second.id)).toBe('closed')
      // следующий проход закрывает и первое
      await tick()
      expect(await status(first.id)).toBe('closed')
    })

    it('edits after the close moment do not stop the scheduled close', async () => {
      const ev = await makeEvent({ capacity: 4, price: 0 })
      at(46 * H + 1)
      // проход ещё не был; правка названия после момента закрытия
      await eventService.update({ userId: ownerId }, ev.id, { title: 'Переименовано' })
      await tick()
      expect((await db.query.events.findFirst({ where: eq(events.id, ev.id) }))!.status).toBe(
        'closed',
      )
    })

    it('a transient failure is retried on the next tick without a skip mark', async () => {
      const ev = await makeEvent({ capacity: 4, price: 0 })
      const record = vi
        .spyOn(auditService, 'record')
        .mockRejectedValueOnce(new Error('deadlock detected'))
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
      at(46 * H)
      await tick()
      expect((await db.query.events.findFirst({ where: eq(events.id, ev.id) }))!.status).toBe(
        'published',
      )
      expect(
        (await db.select().from(scheduledJobs).where(eq(scheduledJobs.eventId, ev.id))).filter(
          (j) => j.kind === 'event.close_skipped',
        ),
      ).toHaveLength(0)
      record.mockRestore()
      warn.mockRestore()
      await tick()
      expect((await db.query.events.findFirst({ where: eq(events.id, ev.id) }))!.status).toBe(
        'closed',
      )
    })

    it('marks a split that cannot be settled and alerts once instead of retrying every tick', async () => {
      vi.stubEnv('EVENT_SPLIT_PRICING_ENABLED', 'true')
      const ev = await makeEvent({ capacity: 4, price: 0, priceMode: 'split', targetAmount: 2 })
      for (const id of await players(3))
        await bookingService.book({ userId: id }, orgId, ev.id, { method: 'cash' })
      const errors = vi.spyOn(console, 'error').mockImplementation(() => {})
      at(46 * H)
      await tick()
      await tick()
      at(46 * H + MIN)
      await tick()
      const alerts = errors.mock.calls.filter((c) => String(c[0]).includes('auto-close failed'))
      errors.mockRestore()
      expect(alerts).toHaveLength(1)
      expect((await db.query.events.findFirst({ where: eq(events.id, ev.id) }))!.status).toBe(
        'published',
      )
      const marks = await db.select().from(scheduledJobs).where(eq(scheduledJobs.eventId, ev.id))
      expect(marks.filter((j) => j.kind === 'event.close_skipped')).toHaveLength(1)
    })

    it('active offers are revoked when booking closes', async () => {
      const ev = await makeEvent({ capacity: 1, price: 0 })
      const [a, b] = await players(2)
      const ba = await bookingService.book({ userId: a! }, orgId, ev.id, { method: 'free' })
      await bookingService.book({ userId: b! }, orgId, ev.id, { method: 'free' })
      at(46 * H - 10 * MIN)
      await bookingService.cancel({ userId: ownerId }, ba.id, { byAdmin: true })
      at(46 * H)
      await tick()
      expect((await offersOf(ev.id)).map((o) => o.status)).toEqual(['revoked'])
    })
  })

  describe('reminders 24 h / 2 h', () => {
    it('reminds roster players once per type, in the group timezone', async () => {
      await db
        .update(organizations)
        .set({ defaultTimezone: 'Asia/Tokyo' })
        .where(eq(organizations.id, orgId))
      const ev = await makeEvent({ capacity: 1, price: 0 })
      const [a, b, c] = await players(3)
      await bookingService.book({ userId: a! }, orgId, ev.id, { method: 'free' })
      await bookingService.book({ userId: b! }, orgId, ev.id, { method: 'free' }) // очередь
      const late = await bookingService.book({ userId: c! }, orgId, ev.id, { method: 'free' })
      await bookingService.cancel({ userId: c! }, late.id)

      at(24 * H - MIN)
      await tick()
      expect(sent).toHaveLength(0)
      at(24 * H)
      await tick()
      await tick()
      expect(await sentTo(a!)).toHaveLength(1)
      expect(await sentTo(b!)).toHaveLength(0)
      expect(await sentTo(c!)).toHaveLength(0)
      const tokyo = new Intl.DateTimeFormat('ru-RU', {
        timeZone: 'Asia/Tokyo',
        hour: '2-digit',
        minute: '2-digit',
      }).format(new Date(BASE + 48 * H))
      expect((await sentTo(a!))[0]!.text).toContain(tokyo)

      at(46 * H)
      await tick()
      await tick()
      const all = await sentTo(a!)
      expect(all).toHaveLength(2)
      expect(all[1]!.text).toContain('Через 2 часа')
      expect(ev.id).toBeGreaterThan(0)
    })

    it('retries delivery with backoff when the bot is down, without duplicates', async () => {
      const ev = await makeEvent({ capacity: 2, price: 0 })
      const [a] = await players(1)
      await bookingService.book({ userId: a! }, orgId, ev.id, { method: 'free' })
      transportDown = true
      at(24 * H)
      await tick()
      expect(sent).toHaveLength(0)
      const [job] = await db.select().from(scheduledJobs).where(eq(scheduledJobs.eventId, ev.id))
      expect(job).toMatchObject({ status: 'pending', attempts: 1 })
      expect(job!.lastError).toContain('bot unavailable')
      expect(job!.runAt.getTime()).toBeGreaterThan(Date.now())
      // до истечения backoff повтора нет
      transportDown = false
      await tick()
      expect(sent).toHaveLength(0)
      at(24 * H + 5 * MIN)
      await tick()
      await tick()
      expect(sent).toHaveLength(1)
      const [done] = await db.select().from(scheduledJobs).where(eq(scheduledJobs.eventId, ev.id))
      expect(done).toMatchObject({ status: 'done', attempts: 2, lastError: null })
    })

    it('a cancelled booking is not reminded even if its job was already queued', async () => {
      const ev = await makeEvent({ capacity: 2, price: 0 })
      const [a] = await players(1)
      const ba = await bookingService.book({ userId: a! }, orgId, ev.id, { method: 'free' })
      transportDown = true
      at(24 * H)
      await tick()
      transportDown = false
      await bookingService.cancel({ userId: a! }, ba.id)
      at(24 * H + 10 * MIN)
      await tick()
      expect(sent).toHaveLength(0)
      const [job] = await db.select().from(scheduledJobs).where(eq(scheduledJobs.eventId, ev.id))
      expect(job!.status).toBe('skipped')
    })

    it('parallel workers deliver each queued notification exactly once', async () => {
      const ev = await makeEvent({ capacity: 10, price: 0 })
      const ids = await players(6)
      for (const id of ids)
        await bookingService.book({ userId: id }, orgId, ev.id, { method: 'free' })
      at(24 * H)
      // постановка без доставки, затем параллельная доставка
      await runSchedulerTick({ now: new Date(), deliver: false })
      const queued = await db.select().from(scheduledJobs).where(eq(scheduledJobs.eventId, ev.id))
      expect(queued).toHaveLength(6)
      await Promise.all([
        processDueJobs({ now: new Date() }),
        processDueJobs({ now: new Date() }),
        processDueJobs({ now: new Date() }),
      ])
      expect(sent).toHaveLength(6)
      expect(new Set(sent.map((p) => p.telegramId)).size).toBe(6)
      const [{ n }] = (await db.execute(
        sql`SELECT count(*)::int AS n FROM scheduled_jobs WHERE status = 'done'`,
      )) as unknown as [{ n: number }]
      expect(n).toBe(6)
    })

    it('a job left running by a crashed worker is retried after its lease, once', async () => {
      const [a] = await players(1)
      await enqueueNotification(db, {
        type: 'reminder_24h',
        dedupKey: 'crash:1',
        userId: a!,
        params: { eventTitle: 'X' },
      })
      // экземпляр захватил задачу и упал до отметки
      await db
        .update(scheduledJobs)
        .set({ status: 'running', attempts: 1, lockedUntil: new Date(BASE + 2 * MIN) })
        .where(eq(scheduledJobs.dedupKey, 'crash:1'))
      await processDueJobs({ now: new Date(BASE + MIN) })
      expect(sent).toHaveLength(0)
      await processDueJobs({ now: new Date(BASE + 2 * MIN) })
      await processDueJobs({ now: new Date(BASE + 3 * MIN) })
      expect(sent).toHaveLength(1)
      const [job] = await db
        .select()
        .from(scheduledJobs)
        .where(eq(scheduledJobs.dedupKey, 'crash:1'))
      expect(job).toMatchObject({ status: 'done', attempts: 2 })
      // повторная постановка с тем же ключом — no-op
      expect(
        await enqueueNotification(db, {
          type: 'reminder_24h',
          dedupKey: 'crash:1',
          userId: a!,
          params: {},
        }),
      ).toBe(false)
    })

    it('delivery stops at its time budget without spending attempts', async () => {
      const [a] = await players(1)
      await enqueueNotification(db, {
        type: 'reminder_2h',
        dedupKey: 'budget:1',
        userId: a!,
        params: {},
      })
      expect(await processDueJobs({ now: new Date(), budgetMs: 0 })).toEqual({
        sent: 0,
        skipped: 0,
        retried: 0,
        failed: 0,
        deferred: 0,
        unreachable: 0,
      })
      const [job] = await db
        .select()
        .from(scheduledJobs)
        .where(eq(scheduledJobs.dedupKey, 'budget:1'))
      expect(job).toMatchObject({ status: 'pending', attempts: 0 })
      await processDueJobs({ now: new Date() })
      expect(sent).toHaveLength(1)
    })

    it('gives up after the attempt limit and purges completed jobs after 90 days', async () => {
      const [a] = await players(1)
      transportDown = true
      await enqueueNotification(db, {
        type: 'reminder_2h',
        dedupKey: 'down:1',
        userId: a!,
        params: {},
      })
      let t = BASE
      for (let i = 0; i < 6; i++) {
        await processDueJobs({ now: new Date(t) })
        t += 31 * MIN
      }
      const [job] = await db
        .select()
        .from(scheduledJobs)
        .where(eq(scheduledJobs.dedupKey, 'down:1'))
      expect(job).toMatchObject({ status: 'failed', attempts: 6 })
      await processDueJobs({ now: new Date(t + 24 * H) })
      expect((await db.select().from(scheduledJobs))[0]!.attempts).toBe(6)
      expect(await purgeCompletedJobs(new Date(t + 89 * 24 * H))).toBe(0)
      expect(await purgeCompletedJobs(new Date(t + 91 * 24 * H))).toBe(1)
      expect(await db.select().from(scheduledJobs)).toHaveLength(0)
    })
  })
})
