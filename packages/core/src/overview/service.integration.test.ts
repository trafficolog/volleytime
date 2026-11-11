import {
  bookings,
  closeDb,
  db,
  eq,
  events,
  organizations,
  payments,
  sql,
  subscriptionPlans,
  subscriptions,
  users,
} from '@volley-time/db'
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { bookingService } from '../bookings/service'
import { collectionService } from '../collections/service'
import { eventService } from '../events/service'
import { ledgerService } from '../ledger/service'
import { memberService } from '../members/service'
import { organizationService } from '../organizations/service'
import { paymentService } from '../payments/service'

import { overviewService } from './service'

/**
 * Task 21.2.18: агрегаты обзора кабинета. Границы месяца и недель — в зоне группы; ряд кассы
 * берётся из журнала кассы и сходится с ним, платежами событий и взносами в сборы.
 */
describe('overviewService (integration)', { timeout: 60_000 }, () => {
  let owner: number
  let orgId: number
  let otherOrg: number
  let seq = 0

  const ctx = (userId: number) => ({ userId })
  const at = (iso: string) => new Date(iso)
  const newUser = async (label: string) =>
    (
      await db
        .insert(users)
        .values({ email: `ov-${label}-${++seq}@t.by`, name: label })
        .returning()
    )[0]!.id
  const addPlayer = async (org = orgId, by = owner) => {
    const id = await newUser('p')
    await memberService.add({ userId: by }, { organizationId: org, userId: id })
    return id
  }
  const overview = (now?: Date, org = orgId) =>
    overviewService.getManagerOverview(ctx(owner), org, now)
  const insertEvent = async (
    startsAt: string,
    extra: Partial<typeof events.$inferInsert> = {},
    org = orgId,
  ) =>
    (
      await db
        .insert(events)
        .values({
          organizationId: org,
          createdByUserId: owner,
          title: 'E',
          startsAt: at(startsAt),
          endsAt: new Date(at(startsAt).getTime() + 7_200_000),
          capacity: 10,
          status: 'published',
          ...extra,
        })
        .returning()
    )[0]!
  const insertBooking = async (
    eventId: number,
    status: (typeof bookings.$inferInsert)['status'],
    seats = 1,
    org = orgId,
  ) =>
    db.insert(bookings).values({
      eventId,
      userId: await newUser('b'),
      organizationId: org,
      status,
      method: 'free',
      seats,
    })
  const income = (amount: number, occurredAt: string, extra: { currency?: string } = {}) =>
    ledgerService.createEntry(ctx(owner), {
      organizationId: orgId,
      type: 'income',
      category: 'other_income',
      amount,
      occurredAt: at(occurredAt),
      ...extra,
    })
  const expense = (amount: number, occurredAt: string) =>
    ledgerService.createEntry(ctx(owner), {
      organizationId: orgId,
      type: 'expense',
      category: 'rent',
      amount,
      occurredAt: at(occurredAt),
    })

  beforeEach(async () => {
    vi.stubEnv('COLLECTIONS_ENABLED', 'true')
    vi.stubEnv('EVENT_MULTI_SEAT_ENABLED', 'true')
    await db.delete(organizations)
    await db.delete(users)
    owner = await newUser('owner')
    orgId = (await organizationService.create(ctx(owner), { name: 'Обзор А' })).id
    const otherOwner = await newUser('owner-b')
    otherOrg = (await organizationService.create(ctx(otherOwner), { name: 'Обзор Б' })).id
  })
  afterAll(async () => {
    vi.unstubAllEnvs()
    await db.delete(organizations)
    await db.delete(users)
    await closeDb()
  })

  it('returns zeros and an empty series for an empty group', async () => {
    const now = at('2026-11-04T12:00:00Z')
    const o = await overview(now)
    expect(o).toMatchObject({
      timezone: 'Europe/Minsk',
      currency: 'BYN',
      events: { thisMonth: 0 },
      bookings: { count: 0, seats: 0, capacity: 0, occupancyPercent: null },
      subscriptions: { active: 0 },
      pendingPayments: { count: 0, amount: 0, currency: 'BYN', items: [] },
      cashWeekly: { currency: 'BYN', total: { income: 0, expense: 0, net: 0 } },
    })
    expect(o.cashWeekly.weeks).toHaveLength(4)
    expect(o.cashWeekly.weeks.every((w) => w.income === 0 && w.expense === 0 && w.net === 0)).toBe(
      true,
    )
    expect(o.month).toEqual({ from: '2026-10-31T21:00:00.000Z', to: '2026-11-30T21:00:00.000Z' })
  })

  describe('events and occupancy', () => {
    const now = at('2026-11-04T12:00:00Z')

    it('counts events by month edges in the group zone', async () => {
      // ноябрь по Минску: [2026-10-31T21:00Z, 2026-11-30T21:00Z)
      await insertEvent('2026-10-31T20:59:59Z') // октябрь по Минску
      await insertEvent('2026-10-31T21:00:00Z') // 1 ноября 00:00 — в месяце
      await insertEvent('2026-11-15T10:00:00Z')
      await insertEvent('2026-11-30T20:59:59Z') // 30 ноября 23:59:59 — в месяце
      await insertEvent('2026-11-30T21:00:00Z') // 1 декабря 00:00 — нет
      expect((await overview(now)).events.thisMonth).toBe(3)
    })

    it('uses the group timezone, not UTC, for the month edge', async () => {
      await db
        .update(organizations)
        .set({ defaultTimezone: 'America/New_York' })
        .where(eq(organizations.id, orgId))
      // Нью-Йорк, ноябрь: [2026-11-01T04:00Z (EDT до 1 ноября 02:00), 2026-12-01T05:00Z)
      await insertEvent('2026-11-01T03:59:59Z') // октябрь
      await insertEvent('2026-11-01T04:00:00Z') // в месяце
      await insertEvent('2026-12-01T04:59:59Z') // в месяце
      await insertEvent('2026-12-01T05:00:00Z') // декабрь
      const o = await overview(now)
      expect(o.timezone).toBe('America/New_York')
      expect(o.events.thisMonth).toBe(2)
    })

    it('ignores drafts, cancelled events and other groups', async () => {
      await insertEvent('2026-11-10T10:00:00Z')
      await insertEvent('2026-11-11T10:00:00Z', { status: 'closed' })
      await insertEvent('2026-11-12T10:00:00Z', { status: 'finished' })
      await insertEvent('2026-11-13T10:00:00Z', { status: 'draft' })
      await insertEvent('2026-11-14T10:00:00Z', { status: 'cancelled' })
      await insertEvent('2026-11-15T10:00:00Z', {}, otherOrg)
      expect((await overview(now)).events.thisMonth).toBe(3)
    })

    it('computes bookings, seats and occupancy over occupying bookings only', async () => {
      const a = await insertEvent('2026-11-10T10:00:00Z', { capacity: 10 })
      const b = await insertEvent('2026-11-12T10:00:00Z', { capacity: 10 })
      const outside = await insertEvent('2026-12-02T10:00:00Z', { capacity: 10 })
      const draft = await insertEvent('2026-11-13T10:00:00Z', { capacity: 10, status: 'draft' })
      await insertBooking(a.id, 'confirmed', 2)
      await insertBooking(a.id, 'pending_payment', 1)
      await insertBooking(a.id, 'attended', 1)
      await insertBooking(b.id, 'no_show', 1)
      await insertBooking(b.id, 'waitlisted', 3) // очередь не занимает места
      await insertBooking(b.id, 'cancelled', 4) // отменённая запись не считается
      await insertBooking(outside.id, 'confirmed', 5) // событие вне месяца
      await insertBooking(draft.id, 'confirmed', 5) // черновик
      const o = await overview(now)
      expect(o.bookings).toEqual({ count: 4, seats: 5, capacity: 20, occupancyPercent: 25 })
    })

    it('rounds occupancy to a whole percent and may exceed 100', async () => {
      const a = await insertEvent('2026-11-10T10:00:00Z', { capacity: 3 })
      await insertBooking(a.id, 'confirmed', 1)
      expect((await overview(now)).bookings.occupancyPercent).toBe(33)
      await insertBooking(a.id, 'confirmed', 3)
      expect((await overview(now)).bookings.occupancyPercent).toBe(133)
    })

    it('does not leak bookings of other groups', async () => {
      const mine = await insertEvent('2026-11-10T10:00:00Z', { capacity: 4 })
      const foreign = await insertEvent('2026-11-10T10:00:00Z', { capacity: 4 }, otherOrg)
      await insertBooking(mine.id, 'confirmed', 1)
      await insertBooking(foreign.id, 'confirmed', 4, otherOrg)
      expect((await overview(now)).bookings).toMatchObject({ seats: 1, capacity: 4 })
    })
  })

  describe('active subscriptions', () => {
    it('counts only live subscriptions of the group', async () => {
      const now = at('2026-11-04T12:00:00Z')
      const [plan] = await db
        .insert(subscriptionPlans)
        .values({ organizationId: orgId, name: 'Plan', totalSessions: 4, price: 0 })
        .returning()
      const [otherPlan] = await db
        .insert(subscriptionPlans)
        .values({ organizationId: otherOrg, name: 'Plan B', totalSessions: 4, price: 0 })
        .returning()
      const sub = async (
        extra: Partial<typeof subscriptions.$inferInsert>,
        org = orgId,
        planId = plan!.id,
      ) =>
        db.insert(subscriptions).values({
          organizationId: org,
          userId: await newUser('s'),
          planId,
          totalSessions: 4,
          status: 'active',
          ...extra,
        })
      await sub({}) // бессрочный
      await sub({ usedSessions: 3, expiresAt: at('2026-11-04T12:00:01Z') }) // истекает через секунду
      await sub({ usedSessions: 4 }) // занятия кончились
      await sub({ expiresAt: at('2026-11-04T12:00:00Z') }) // истёк ровно сейчас
      await sub({ expiresAt: at('2026-11-01T00:00:00Z') }) // истёк
      await sub({ status: 'pending' })
      await sub({ status: 'exhausted', usedSessions: 4 })
      await sub({ status: 'expired' })
      await sub({ status: 'cancelled' })
      await sub({}, otherOrg, otherPlan!.id)
      expect((await overview(now)).subscriptions.active).toBe(2)
    })
  })

  describe('pending payments', () => {
    it('lists every pending row with per-row amounts and totals only the group currency', async () => {
      const buyer1 = await addPlayer()
      const buyer2 = await addPlayer()
      const event = await eventService.create(ctx(owner), orgId, {
        title: 'Основа',
        startsAt: new Date(Date.now() + 86_400_000),
        endsAt: new Date(Date.now() + 93_600_000),
        capacity: 6,
        price: 1500,
      })
      await bookingService.book(ctx(buyer1), orgId, event.id, { method: 'cash' })
      await bookingService.book(ctx(buyer2), orgId, event.id, { method: 'cash', seats: 2 })
      const collection = await collectionService.create(ctx(owner), orgId, {
        title: 'Мячи',
        targetAmount: 10_000,
      })
      await collectionService.contribute(ctx(buyer1), orgId, collection.id, {
        amount: 700,
        method: 'cash',
      })
      // платёж в другой валюте: в строки попадает, в сумму группы нет
      await db.insert(payments).values({
        organizationId: orgId,
        userId: buyer1,
        amount: 999,
        currency: 'USD',
        method: 'cash',
        status: 'pending',
      })
      // платёж другой группы
      const foreignBuyer = await addPlayer(otherOrg, (await ownerOf(otherOrg))!)
      await db.insert(payments).values({
        organizationId: otherOrg,
        userId: foreignBuyer,
        amount: 5000,
        currency: 'BYN',
        method: 'cash',
        status: 'pending',
      })

      const o = await overview()
      const items = o.pendingPayments.items
      expect(items).toHaveLength(4)
      expect(o.pendingPayments.count).toBe(4)
      expect(o.pendingPayments.currency).toBe('BYN')
      expect(o.pendingPayments.amount).toBe(1500 + 3000 + 700)
      const byAmount = new Map(items.map((i) => [i.amount, i]))
      expect(byAmount.get(1500)).toMatchObject({
        seats: 1,
        user: { id: buyer1 },
        event: { id: event.id, title: 'Основа' },
        collection: null,
      })
      expect(byAmount.get(3000)).toMatchObject({ seats: 2, event: { id: event.id } })
      expect(byAmount.get(700)).toMatchObject({ collection: { id: collection.id, title: 'Мячи' } })
      expect(byAmount.get(999)).toMatchObject({ currency: 'USD', event: null })
      expect(Date.parse(items[0]!.createdAt)).not.toBeNaN()
      // публичные поля игрока: ничего лишнего
      expect(Object.keys(items[0]!.user).sort()).toEqual(['id', 'name', 'telegramUsername'])
    })

    it('drops cancelled bookings and confirmed payments from the list', async () => {
      const p1 = await addPlayer()
      const p2 = await addPlayer()
      const event = await eventService.create(ctx(owner), orgId, {
        title: 'Основа',
        startsAt: new Date(Date.now() + 86_400_000),
        endsAt: new Date(Date.now() + 93_600_000),
        capacity: 6,
        price: 1500,
      })
      const b1 = await bookingService.book(ctx(p1), orgId, event.id, { method: 'cash' })
      await bookingService.book(ctx(p2), orgId, event.id, { method: 'cash' })
      expect((await overview()).pendingPayments.count).toBe(2)
      await bookingService.cancel(ctx(owner), b1.id, { byAdmin: true })
      const rest = await overview()
      expect(rest.pendingPayments).toMatchObject({ count: 1, amount: 1500 })
      await paymentService.confirm(ctx(owner), rest.pendingPayments.items[0]!.id, { orgId })
      expect((await overview()).pendingPayments).toMatchObject({ count: 0, amount: 0, items: [] })
    })
  })

  describe('weekly cash series', () => {
    const now = at('2026-11-04T12:00:00Z') // среда; недели по Минску: 12.10, 19.10, 26.10, 02.11

    it('puts operations into weeks by group-zone Monday midnight', async () => {
      await income(100, '2026-10-11T20:59:59Z') // до первой недели
      await income(200, '2026-10-11T21:00:00Z') // пн 12.10 00:00 — неделя 1
      await income(300, '2026-10-18T20:59:59Z') // вс 18.10 23:59:59 — неделя 1
      await income(400, '2026-10-18T21:00:00Z') // пн 19.10 — неделя 2
      await income(500, '2026-11-01T20:59:59Z') // вс 01.11 — неделя 3
      await income(600, '2026-11-01T21:00:00Z') // пн 02.11 — неделя 4
      await income(700, '2026-11-08T20:59:59Z') // вс 08.11 23:59:59 — неделя 4
      await income(800, '2026-11-08T21:00:00Z') // следующая неделя — вне ряда
      await expense(50, '2026-11-03T10:00:00Z')
      await expense(70, '2026-10-20T10:00:00Z')
      const { weeks, total } = (await overview(now)).cashWeekly
      expect(weeks.map((w) => w.from)).toEqual([
        '2026-10-11T21:00:00.000Z',
        '2026-10-18T21:00:00.000Z',
        '2026-10-25T21:00:00.000Z',
        '2026-11-01T21:00:00.000Z',
      ])
      expect(weeks.map((w) => [w.income, w.expense, w.net])).toEqual([
        [500, 0, 500],
        [400, 70, 330],
        [500, 0, 500],
        [1300, 50, 1250],
      ])
      expect(total).toEqual({ income: 2700, expense: 120, net: 2580 })
    })

    it('excludes other currencies and other groups', async () => {
      await income(100, '2026-11-03T10:00:00Z')
      await income(9999, '2026-11-03T10:00:00Z', { currency: 'USD' })
      await ledgerService.createEntry(ctx(owner), {
        organizationId: otherOrg,
        type: 'income',
        category: 'other_income',
        amount: 7777,
        occurredAt: at('2026-11-03T10:00:00Z'),
      })
      const { weeks, total, currency } = (await overview(now)).cashWeekly
      expect(currency).toBe('BYN')
      expect(weeks[3]).toMatchObject({ income: 100, expense: 0, net: 100 })
      expect(total.income).toBe(100)
    })

    it('shifts week edges with the group timezone', async () => {
      await db
        .update(organizations)
        .set({ defaultTimezone: 'Pacific/Auckland' }) // UTC+13 в ноябре
        .where(eq(organizations.id, orgId))
      // пн 02.11 00:00 в Окленде = вс 01.11 11:00Z
      await income(100, '2026-11-01T10:59:59Z') // ещё неделя 3
      await income(200, '2026-11-01T11:00:00Z') // неделя 4
      const { weeks } = (await overview(now)).cashWeekly
      expect(weeks[2]!.income).toBe(100)
      expect(weeks[3]!.income).toBe(200)
    })

    it('reconciles with the cash desk, event payments and collection receipts', async () => {
      const p1 = await addPlayer()
      const p2 = await addPlayer()
      const p3 = await addPlayer()
      const event = await eventService.create(ctx(owner), orgId, {
        title: 'Основа',
        startsAt: new Date(Date.now() + 86_400_000),
        endsAt: new Date(Date.now() + 93_600_000),
        capacity: 6,
        price: 1500,
      })
      const pay = async (user: number) => {
        await bookingService.book(ctx(user), orgId, event.id, { method: 'cash' })
        const row = (await paymentService.listPending(ctx(owner), orgId)).find(
          (p) => p.user.id === user,
        )!
        await paymentService.confirm(ctx(owner), row.id, { orgId })
        return row.id
      }
      await pay(p1)
      const refundedId = await pay(p2)
      await paymentService.refund(ctx(owner), refundedId, 'Возврат')
      // отменённая запись без оплаты: денег не создаёт
      const cancelled = await bookingService.book(ctx(p3), orgId, event.id, { method: 'cash' })
      await bookingService.cancel(ctx(owner), cancelled.id, { byAdmin: true })
      // взнос в сбор: подтверждён организатором
      const collection = await collectionService.create(ctx(owner), orgId, {
        title: 'Мячи',
        targetAmount: 10_000,
      })
      const { contribution } = await collectionService.contribute(ctx(p1), orgId, collection.id, {
        amount: 2500,
        method: 'cash',
      })
      await collectionService.confirmContribution(ctx(owner), orgId, collection.id, contribution.id)
      await ledgerService.addExpense(ctx(owner), orgId, {
        category: 'rent',
        amount: 800,
        description: 'Аренда',
      })

      const o = await overview()
      const balance = await ledgerService.getBalance(ctx(owner), orgId)
      const desk = await ledgerService.getPeriodTotals(ctx(owner), orgId, {
        from: new Date(o.cashWeekly.weeks[0]!.from),
        to: new Date(o.cashWeekly.weeks[3]!.to),
      })
      // 1500 + 1500 (потом возврат 1500) + 2500 взнос − 800 аренда
      expect(o.cashWeekly.total).toEqual({ income: 5500, expense: 2300, net: 3200 })
      expect(o.cashWeekly.total.income).toBe(desk.income)
      expect(o.cashWeekly.total.expense).toBe(desk.expense)
      expect(o.cashWeekly.total.net).toBe(balance.balance)
      // платёж события и взнос — суммы платежей, подтверждённых в окне
      const [succeeded] = await db.execute<{ n: number }>(
        sql`SELECT coalesce(sum(amount), 0)::int AS n FROM payments WHERE organization_id = ${orgId} AND status IN ('succeeded', 'refunded')`,
      )
      expect(succeeded!.n).toBe(o.cashWeekly.total.income)
      // всё произошло на текущей неделе
      expect(o.cashWeekly.weeks.slice(0, 3).every((w) => w.income === 0 && w.expense === 0)).toBe(
        true,
      )
      expect(o.cashWeekly.weeks[3]).toMatchObject({ income: 5500, expense: 2300, net: 3200 })
      // «Ждёт оплаты» не затрагивает ряд кассы
      expect(o.pendingPayments.count).toBe(0)
    })
  })

  describe('deltas (21.4.4)', () => {
    const now = at('2026-11-04T12:00:00Z') // среда; прошлый месяц по Минску: [2026-09-30T21:00Z, 2026-10-31T21:00Z)

    it('is null for a month-over-month delta when the previous month has no events', async () => {
      await insertEvent('2026-11-10T10:00:00Z')
      const o = await overview(now)
      expect(o.deltas.eventsVsPreviousMonth).toBeNull()
      expect(o.deltas.previousMonth).toEqual({
        from: '2026-09-30T21:00:00.000Z',
        to: '2026-10-31T21:00:00.000Z',
      })
    })

    it('counts the event delta against the previous month by group-zone edges, excluding drafts and cancelled', async () => {
      await insertEvent('2026-09-30T20:59:59Z') // сентябрь — не прошлый месяц
      await insertEvent('2026-09-30T21:00:00Z') // 1 октября 00:00 — прошлый месяц
      await insertEvent('2026-10-15T10:00:00Z')
      await insertEvent('2026-10-31T20:59:59Z') // 31 октября 23:59:59 — прошлый месяц
      await insertEvent('2026-10-20T10:00:00Z', { status: 'draft' })
      await insertEvent('2026-10-21T10:00:00Z', { status: 'cancelled' })
      await insertEvent('2026-10-22T10:00:00Z', {}, otherOrg)
      for (const d of ['10', '11', '12', '13', '14']) await insertEvent(`2026-11-${d}T10:00:00Z`)
      const o = await overview(now)
      expect(o.events.thisMonth).toBe(5)
      expect(o.deltas.eventsVsPreviousMonth).toBe(2) // 5 - 3
    })

    it('can be negative and zero', async () => {
      await insertEvent('2026-10-10T10:00:00Z')
      await insertEvent('2026-10-11T10:00:00Z')
      await insertEvent('2026-11-10T10:00:00Z')
      expect((await overview(now)).deltas.eventsVsPreviousMonth).toBe(-1)
      await insertEvent('2026-11-11T10:00:00Z')
      expect((await overview(now)).deltas.eventsVsPreviousMonth).toBe(0)
    })

    it('uses the group timezone for the previous month edge', async () => {
      await db
        .update(organizations)
        .set({ defaultTimezone: 'America/New_York' })
        .where(eq(organizations.id, orgId))
      // Нью-Йорк: октябрь = [2026-10-01T04:00Z, 2026-11-01T04:00Z)
      await insertEvent('2026-10-01T03:59:59Z') // сентябрь
      await insertEvent('2026-10-01T04:00:00Z') // октябрь
      await insertEvent('2026-11-01T03:59:59Z') // октябрь
      await insertEvent('2026-11-01T04:00:00Z') // ноябрь
      const o = await overview(now)
      expect(o.events.thisMonth).toBe(1)
      expect(o.deltas.eventsVsPreviousMonth).toBe(-1)
    })

    it('counts usable subscriptions expiring within the next 7 days', async () => {
      const [plan] = await db
        .insert(subscriptionPlans)
        .values({ organizationId: orgId, name: 'Plan', totalSessions: 4, price: 0 })
        .returning()
      const [otherPlan] = await db
        .insert(subscriptionPlans)
        .values({ organizationId: otherOrg, name: 'Plan B', totalSessions: 4, price: 0 })
        .returning()
      const sub = async (
        extra: Partial<typeof subscriptions.$inferInsert>,
        org = orgId,
        planId = plan!.id,
      ) =>
        db.insert(subscriptions).values({
          organizationId: org,
          userId: await newUser('s'),
          planId,
          totalSessions: 4,
          status: 'active',
          ...extra,
        })
      await sub({ expiresAt: at('2026-11-04T12:00:01Z') }) // через секунду — в окне
      await sub({ expiresAt: at('2026-11-11T12:00:00Z') }) // ровно через 7 дней — в окне
      await sub({ expiresAt: at('2026-11-11T12:00:01Z') }) // позже окна
      await sub({ expiresAt: at('2026-11-04T12:00:00Z') }) // уже истёк
      await sub({}) // бессрочный
      await sub({ expiresAt: at('2026-11-06T10:00:00Z'), usedSessions: 4 }) // занятия кончились
      await sub({ expiresAt: at('2026-11-06T10:00:00Z'), status: 'cancelled' })
      await sub({ expiresAt: at('2026-11-06T10:00:00Z') }, otherOrg, otherPlan!.id)
      const o = await overview(now)
      expect(o.deltas.subscriptionsExpiringSoon).toBe(2)
      expect(o.subscriptions.active).toBe(4) // три с будущим сроком и один бессрочный
    })

    it('equals the net of the current week in the cash series, with refunds and cancelled bookings', async () => {
      const p1 = await addPlayer()
      const p2 = await addPlayer()
      const p3 = await addPlayer()
      const event = await eventService.create(ctx(owner), orgId, {
        title: 'Основа',
        startsAt: new Date(Date.now() + 86_400_000),
        endsAt: new Date(Date.now() + 93_600_000),
        capacity: 6,
        price: 1500,
      })
      const pay = async (user: number) => {
        await bookingService.book(ctx(user), orgId, event.id, { method: 'cash' })
        const row = (await paymentService.listPending(ctx(owner), orgId)).find(
          (p) => p.user.id === user,
        )!
        await paymentService.confirm(ctx(owner), row.id, { orgId })
        return row.id
      }
      await pay(p1)
      await paymentService.refund(ctx(owner), await pay(p2), 'Возврат')
      const cancelled = await bookingService.book(ctx(p3), orgId, event.id, { method: 'cash' })
      await bookingService.cancel(ctx(owner), cancelled.id, { byAdmin: true })
      await ledgerService.addExpense(ctx(owner), orgId, {
        category: 'rent',
        amount: 800,
        description: 'Аренда',
      })
      const o = await overview()
      // 1500 + 1500 - 1500 (возврат) - 800
      expect(o.deltas.cashWeekNet).toBe(700)
      expect(o.deltas.cashWeekNet).toBe(o.cashWeekly.weeks[3]!.net)
      expect(o.deltas.cashWeekNet).toBe(o.cashWeekly.total.net) // всё на текущей неделе
    })

    it('does not mix earlier weeks into the week delta', async () => {
      await income(1000, '2026-10-20T10:00:00Z') // неделя 2
      await income(300, '2026-11-03T10:00:00Z') // текущая
      await expense(50, '2026-11-02T10:00:00Z') // текущая
      const o = await overview(now)
      expect(o.deltas.cashWeekNet).toBe(250)
      expect(o.cashWeekly.total.net).toBe(1250)
    })

    it('is zero for an empty group', async () => {
      const o = await overview(now)
      expect(o.deltas).toMatchObject({
        eventsVsPreviousMonth: null,
        subscriptionsExpiringSoon: 0,
        cashWeekNet: 0,
      })
    })
  })

  async function ownerOf(org: number) {
    const row = await db.query.organizationMembers.findFirst({
      where: (m, { and, eq: e }) => and(e(m.organizationId, org), e(m.role, 'owner')),
    })
    return row?.userId
  }
})
