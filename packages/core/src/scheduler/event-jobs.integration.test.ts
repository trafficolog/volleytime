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
import { bookingService } from '../bookings/service'
import { eventService } from '../events/service'
import { memberService } from '../members/service'
import { setNotifierTransport } from '../notifier/service'
import type { NotifyPayload } from '../notifier/types'
import { organizationService } from '../organizations/service'

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
      await expect(
        makeEvent({ capacity: 4, bookingOpensAt: new Date(BASE + 48 * H) }),
      ).rejects.toThrow()
      await expect(
        makeEvent({ capacity: 4, bookingOpensAt: new Date(BASE - H) }),
      ).rejects.toMatchObject({ code: 'event.booking_opens_in_past' })
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

    it('leaves an unsettleable split event to the organizer without failing the tick', async () => {
      vi.stubEnv('EVENT_SPLIT_PRICING_ENABLED', 'true')
      const ev = await makeEvent({ capacity: 4, price: 0, priceMode: 'split', targetAmount: 1001 })
      at(46 * H)
      await expect(tick()).resolves.toBeDefined()
      expect((await db.query.events.findFirst({ where: eq(events.id, ev.id) }))!.status).toBe(
        'published',
      )
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
