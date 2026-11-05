import {
  bookings,
  closeDb,
  db,
  eq,
  events,
  organizations,
  payments,
  subscriptionPlans,
  subscriptions,
  users,
  type DbOrTx,
} from '@volley-time/db'
import { resolveReportPeriod } from '@volley-time/shared'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'

import { organizationService } from '../organizations/service'
import { overviewService } from '../overview/service'
import { paymentService } from '../payments/service'
import { reportsService } from '../reports/service'

import { PlayersStatsQuery } from './schemas'
import { playerStatsService } from './stats'

/**
 * Task 21.2.20: агрегаты игроков (посещаемость, абонемент, долг). Посещаемость — из
 * `reportsService.getPlayerAttendance` (общий источник с отчётами 21.2.7), долг сходится с
 * «ждут оплаты» кассы (`paymentService.listPending`), абонементы — с обзором. Зона группы —
 * Europe/Minsk (UTC+3), чужая группа в цифры не попадает.
 */
describe('playerStatsService (integration)', { timeout: 60_000 }, () => {
  let owner: number
  let orgId: number
  let otherOrg: number
  let otherOwner: number
  let seq = 0

  const ctx = (userId: number) => ({ userId })
  const at = (iso: string) => new Date(iso)
  const MAY = { from: '2026-05-01', to: '2026-05-31' }
  const NOW = at('2026-05-20T12:00:00Z')

  const newUser = async (label: string) =>
    (
      await db
        .insert(users)
        .values({ email: `ps-${label}-${++seq}@t.by`, name: label })
        .returning()
    )[0]!.id
  const insertEvent = async (
    startsAt: string,
    extra: Partial<typeof events.$inferInsert> = {},
    org = orgId,
    by = owner,
  ) =>
    (
      await db
        .insert(events)
        .values({
          organizationId: org,
          createdByUserId: by,
          title: 'E',
          startsAt: at(startsAt),
          endsAt: new Date(at(startsAt).getTime() + 7_200_000),
          capacity: 10,
          status: 'published',
          ...extra,
        })
        .returning()
    )[0]!
  const book = async (
    eventId: number,
    userId: number,
    status: (typeof bookings.$inferInsert)['status'],
    seats = 1,
    org = orgId,
  ) =>
    (
      await db
        .insert(bookings)
        .values({ eventId, userId, organizationId: org, status, method: 'cash', seats })
        .returning()
    )[0]!
  const pay = (
    booking: typeof bookings.$inferSelect,
    status: (typeof payments.$inferInsert)['status'],
    extra: Partial<typeof payments.$inferInsert> = {},
  ) =>
    db.insert(payments).values({
      organizationId: booking.organizationId,
      userId: booking.userId,
      bookingId: booking.id,
      bookingIncarnation: booking.incarnation,
      amount: 1500,
      method: 'cash',
      status,
      ...extra,
    })
  const subscribe = async (
    userId: number,
    extra: Partial<typeof subscriptions.$inferInsert> = {},
    org = orgId,
  ) => {
    const plan =
      (await db.query.subscriptionPlans.findFirst({
        where: eq(subscriptionPlans.organizationId, org),
      })) ??
      (
        await db
          .insert(subscriptionPlans)
          .values({ organizationId: org, name: 'P-8', totalSessions: 8, price: 8000 })
          .returning()
      )[0]!
    return (
      await db
        .insert(subscriptions)
        .values({
          organizationId: org,
          userId,
          planId: plan.id,
          totalSessions: 8,
          usedSessions: 3,
          status: 'active',
          ...extra,
        })
        .returning()
    )[0]!
  }
  const stats = async (userIds: number[], dates = MAY, org = orgId) =>
    (await playerStatsService.getForUsers(ctx(owner), org, userIds, { dates, now: NOW })).byUser

  beforeEach(async () => {
    await db.delete(organizations)
    await db.delete(users)
    owner = await newUser('owner')
    orgId = (await organizationService.create(ctx(owner), { name: 'Игроки А' })).id
    otherOwner = await newUser('owner-b')
    otherOrg = (await organizationService.create(ctx(otherOwner), { name: 'Игроки Б' })).id
  })
  afterAll(async () => {
    await db.delete(organizations)
    await db.delete(users)
    await closeDb()
  })

  describe('attendance', () => {
    it('gives a player without bookings empty stats, not an error', async () => {
      const p = await newUser('empty')
      const s = (await stats([p])).get(p)!
      expect(s.attendance).toEqual({
        visits: 0,
        noShows: 0,
        cancellations: 0,
        ratePercent: null,
        lastVisitAt: null,
      })
      expect(s.subscription).toBeNull()
      expect(s.debt).toEqual({ amount: 0, seats: 0, currency: 'BYN' })
    })

    it('returns nothing for an empty list without querying', async () => {
      const r = await playerStatsService.getForUsers(ctx(owner), orgId, [], { dates: MAY })
      expect(r.byUser.size).toBe(0)
      expect(r.period).toEqual(MAY)
    })

    it('matches the attendance report for the same period, per player and in total', async () => {
      const a = await newUser('a')
      const b = await newUser('b')
      const e1 = await insertEvent('2026-05-05T10:00:00Z')
      const e2 = await insertEvent('2026-05-12T10:00:00Z')
      const e3 = await insertEvent('2026-05-19T10:00:00Z')
      await book(e1.id, a, 'attended', 2)
      await book(e2.id, a, 'attended')
      await book(e3.id, a, 'no_show')
      await book(e1.id, b, 'no_show')
      await book(e2.id, b, 'cancelled')
      const byUser = await stats([a, b])
      const period = resolveReportPeriod(MAY.from, MAY.to, 'Europe/Minsk')!
      const report = await reportsService.getPlayerAttendance(ctx(owner), orgId, period)
      expect(report).toHaveLength(2)
      for (const row of report) {
        expect(byUser.get(row.userId)!.attendance).toMatchObject({
          visits: row.visits,
          noShows: row.noShows,
          cancellations: row.cancellations,
          lastVisitAt: row.lastVisitAt,
        })
      }
      const managerReport = await reportsService.getManagerReport(ctx(owner), orgId, MAY)
      const sum = (k: 'visits' | 'noShows' | 'cancellations') =>
        [a, b].reduce((acc, id) => acc + byUser.get(id)!.attendance[k], 0)
      expect(sum('visits')).toBe(managerReport.attendance.visits)
      expect(sum('noShows')).toBe(managerReport.attendance.noShows)
      expect(sum('cancellations')).toBe(managerReport.attendance.cancellations)
      expect(byUser.get(a)!.attendance).toMatchObject({
        visits: 2,
        noShows: 1,
        ratePercent: 67,
        lastVisitAt: '2026-05-12T10:00:00.000Z',
      })
      expect(byUser.get(b)!.attendance.ratePercent).toBe(0)
    })

    it('counts a past confirmed booking as neither a visit nor a no-show', async () => {
      const p = await newUser('p')
      const e = await insertEvent('2026-05-05T10:00:00Z')
      await book(e.id, p, 'confirmed')
      expect((await stats([p])).get(p)!.attendance).toMatchObject({
        visits: 0,
        noShows: 0,
        ratePercent: null,
      })
    })

    it('puts period boundaries in the group zone: May 1 00:00 Minsk is in, June 1 00:00 is out', async () => {
      const p = await newUser('p')
      const before = await insertEvent('2026-04-30T20:59:59Z') // 30 апр 23:59:59 по Минску
      const first = await insertEvent('2026-04-30T21:00:00Z') // 1 мая 00:00:00
      const last = await insertEvent('2026-05-31T20:59:59Z') // 31 мая 23:59:59
      const after = await insertEvent('2026-05-31T21:00:00Z') // 1 июня 00:00:00
      for (const e of [before, first, last, after]) await book(e.id, p, 'attended')
      expect((await stats([p])).get(p)!.attendance.visits).toBe(2)
    })

    it('ignores draft and cancelled events, like the report', async () => {
      const p = await newUser('p')
      const draft = await insertEvent('2026-05-05T10:00:00Z', { status: 'draft' })
      const cancelled = await insertEvent('2026-05-06T10:00:00Z', { status: 'cancelled' })
      await book(draft.id, p, 'attended')
      await book(cancelled.id, p, 'attended')
      expect((await stats([p])).get(p)!.attendance.visits).toBe(0)
    })

    it('does not mix another group in, even for the same user', async () => {
      const p = await newUser('p')
      const mine = await insertEvent('2026-05-05T10:00:00Z')
      const foreign = await insertEvent('2026-05-06T10:00:00Z', {}, otherOrg, otherOwner)
      await book(mine.id, p, 'attended')
      const foreign2 = await insertEvent('2026-05-07T10:00:00Z', {}, otherOrg, otherOwner)
      await book(foreign.id, p, 'attended', 1, otherOrg)
      await book(foreign2.id, p, 'attended', 1, otherOrg)
      expect((await stats([p])).get(p)!.attendance.visits).toBe(1)
      expect((await stats([p], MAY, otherOrg)).get(p)!.attendance.visits).toBe(2)
    })

    it('uses the last 90 group days by default, ending today', async () => {
      const p = await newUser('p')
      await insertEvent('2026-02-20T10:00:00Z') // 89 дней до 20 мая: на границе окна
      const inside = await insertEvent('2026-02-21T10:00:00Z')
      const outside = await insertEvent('2026-02-19T10:00:00Z')
      await book(inside.id, p, 'attended')
      await book(outside.id, p, 'attended')
      const r = await playerStatsService.getForUsers(ctx(owner), orgId, [p], { now: NOW })
      expect(r.period).toEqual({ from: '2026-02-20', to: '2026-05-20' })
      expect(r.byUser.get(p)!.attendance.visits).toBe(1)
    })
  })

  describe('debt', () => {
    it('counts live pending seat payments and matches the cash desk "waiting" list', async () => {
      const a = await newUser('a')
      const b = await newUser('b')
      const e1 = await insertEvent('2026-05-10T10:00:00Z') // прошедшее
      const e2 = await insertEvent('2026-05-30T10:00:00Z') // ожидающее
      const a1 = await book(e1.id, a, 'attended', 2)
      await pay(a1, 'pending')
      await pay(a1, 'pending')
      const a2 = await book(e2.id, a, 'pending_payment')
      await pay(a2, 'pending', { amount: 700 })
      const b1 = await book(e2.id, b, 'pending_payment')
      await pay(b1, 'pending')
      const byUser = await stats([a, b])
      expect(byUser.get(a)!.debt).toEqual({ amount: 3700, seats: 3, currency: 'BYN' })
      expect(byUser.get(b)!.debt).toEqual({ amount: 1500, seats: 1, currency: 'BYN' })

      const pending = await paymentService.listPending(ctx(owner), orgId)
      for (const user of [a, b]) {
        const rows = pending.filter((p) => p.user.id === user && p.bookingId !== null)
        expect(byUser.get(user)!.debt).toMatchObject({
          amount: rows.reduce((acc, p) => acc + p.amount, 0),
          seats: rows.reduce((acc, p) => acc + p.seats, 0),
        })
      }
      // обзор: сумма долгов игроков = сумма «ждут оплаты» в валюте группы
      const overview = await overviewService.getManagerOverview(ctx(owner), orgId, NOW)
      expect(overview.pendingPayments.amount).toBe(
        byUser.get(a)!.debt.amount + byUser.get(b)!.debt.amount,
      )
    })

    it('does not count paid, refunded, cancelled and released-paid seats', async () => {
      const p = await newUser('p')
      const e = await insertEvent('2026-05-10T10:00:00Z')
      const booking = await book(e.id, p, 'confirmed', 5)
      await pay(booking, 'succeeded')
      await pay(booking, 'refunded')
      await pay(booking, 'cancelled')
      // оплаченное место освобождено без возврата (D-14): не долг
      await pay(booking, 'succeeded', { seatReleasedAt: at('2026-05-11T10:00:00Z') })
      await pay(booking, 'pending')
      const debt = (await stats([p])).get(p)!.debt
      expect(debt).toEqual({ amount: 1500, seats: 1, currency: 'BYN' })
    })

    it('excludes cancelled bookings, payments of a past incarnation, cancelled and draft events', async () => {
      const p = await newUser('p')
      const e = await insertEvent('2026-05-10T10:00:00Z')
      const cancelledBooking = await book(e.id, p, 'cancelled')
      await pay(cancelledBooking, 'pending')
      const reactivated = await book((await insertEvent('2026-05-11T10:00:00Z')).id, p, 'confirmed')
      await pay(reactivated, 'pending', { bookingIncarnation: reactivated.incarnation + 1 })
      const cancelledEvent = await insertEvent('2026-05-12T10:00:00Z', { status: 'cancelled' })
      await pay(await book(cancelledEvent.id, p, 'pending_payment'), 'pending')
      const draft = await insertEvent('2026-05-13T10:00:00Z', { status: 'draft' })
      await pay(await book(draft.id, p, 'pending_payment'), 'pending')
      expect((await stats([p])).get(p)!.debt).toEqual({ amount: 0, seats: 0, currency: 'BYN' })
    })

    it('ignores other currencies and does not count subscription or collection payments', async () => {
      const p = await newUser('p')
      const e = await insertEvent('2026-05-10T10:00:00Z')
      const booking = await book(e.id, p, 'pending_payment', 2)
      await pay(booking, 'pending')
      await pay(booking, 'pending', { currency: 'USD', amount: 99_000 })
      const sub = await subscribe(p, { status: 'pending', usedSessions: 0 })
      await db.insert(payments).values({
        organizationId: orgId,
        userId: p,
        subscriptionId: sub.id,
        amount: 8000,
        method: 'cash',
        status: 'pending',
      })
      expect((await stats([p])).get(p)!.debt).toEqual({ amount: 1500, seats: 1, currency: 'BYN' })
    })

    it('keeps debt independent of the attendance period', async () => {
      const p = await newUser('p')
      const e = await insertEvent('2026-01-10T10:00:00Z')
      await pay(await book(e.id, p, 'no_show'), 'pending')
      const s = (await stats([p])).get(p)!
      expect(s.attendance.noShows).toBe(0)
      expect(s.debt.amount).toBe(1500)
    })

    it('does not mix another group in', async () => {
      const p = await newUser('p')
      const foreign = await insertEvent('2026-05-10T10:00:00Z', {}, otherOrg, otherOwner)
      await pay(await book(foreign.id, p, 'pending_payment', 1, otherOrg), 'pending')
      expect((await stats([p])).get(p)!.debt.amount).toBe(0)
      expect((await stats([p], MAY, otherOrg)).get(p)!.debt.amount).toBe(1500)
    })
  })

  describe('subscription', () => {
    it('shows remaining sessions and expiry of the active subscription', async () => {
      const p = await newUser('p')
      await subscribe(p, { expiresAt: at('2026-06-30T00:00:00Z') })
      expect((await stats([p])).get(p)!.subscription).toEqual({
        remaining: 5,
        total: 8,
        expiresAt: '2026-06-30T00:00:00.000Z',
        count: 1,
      })
    })

    it('hides expired, exhausted, pending and cancelled subscriptions', async () => {
      const p = await newUser('p')
      await subscribe(p, { expiresAt: at('2026-05-20T11:59:59Z') }) // истёк до NOW
      await subscribe(p, { status: 'exhausted', usedSessions: 8 })
      await subscribe(p, { status: 'pending', usedSessions: 0 })
      await subscribe(p, { status: 'cancelled' })
      await subscribe(p, { status: 'expired' })
      expect((await stats([p])).get(p)!.subscription).toBeNull()
    })

    it('keeps a subscription that expires later than now and an unlimited one', async () => {
      const p = await newUser('p')
      const q = await newUser('q')
      await subscribe(p, { expiresAt: at('2026-05-20T12:00:01Z') })
      await subscribe(q, { expiresAt: null })
      const byUser = await stats([p, q])
      expect(byUser.get(p)!.subscription).not.toBeNull()
      expect(byUser.get(q)!.subscription).toMatchObject({ remaining: 5, expiresAt: null })
    })

    it('sums several active subscriptions and takes the nearest expiry', async () => {
      const p = await newUser('p')
      await subscribe(p, { expiresAt: at('2026-08-01T00:00:00Z'), usedSessions: 6 })
      await subscribe(p, { expiresAt: at('2026-07-01T00:00:00Z'), usedSessions: 1 })
      await subscribe(p, { expiresAt: null, usedSessions: 0 })
      expect((await stats([p])).get(p)!.subscription).toEqual({
        remaining: 2 + 7 + 8,
        total: 24,
        expiresAt: '2026-07-01T00:00:00.000Z',
        count: 3,
      })
    })

    it('agrees with the overview count of active subscriptions and ignores other groups', async () => {
      const a = await newUser('a')
      const b = await newUser('b')
      const c = await newUser('c')
      await subscribe(a)
      await subscribe(b, { expiresAt: at('2026-05-01T00:00:00Z') })
      await subscribe(c, { status: 'exhausted', usedSessions: 8 })
      await subscribe(a, {}, otherOrg)
      const byUser = await stats([a, b, c])
      const holders = [a, b, c].filter((id) => byUser.get(id)!.subscription !== null)
      const overview = await overviewService.getManagerOverview(ctx(owner), orgId, NOW)
      expect(holders).toEqual([a])
      expect(overview.subscriptions.active).toBe(
        [a, b, c].reduce((acc, id) => acc + (byUser.get(id)!.subscription?.count ?? 0), 0),
      )
      expect(byUser.get(a)!.subscription!.count).toBe(1)
    })
  })

  describe('batching', () => {
    it('runs the same number of queries for 3 and for 30 players', async () => {
      const players = await Promise.all(Array.from({ length: 30 }, (_, i) => newUser(`m${i}`)))
      const e = await insertEvent('2026-05-10T10:00:00Z')
      const e2 = await insertEvent('2026-05-11T10:00:00Z')
      for (const id of players) {
        await book(e.id, id, 'attended')
        await subscribe(id)
        await pay(await book(e2.id, id, 'pending_payment'), 'pending')
      }
      const count = async (ids: number[]) => {
        let queries = 0
        const spy = new Proxy(db, {
          get(target, prop, receiver) {
            if (prop === 'select' || prop === 'query' || prop === 'execute') queries++
            return Reflect.get(target, prop, receiver)
          },
        }) as unknown as DbOrTx
        const r = await playerStatsService.getForUsers({ userId: owner, db: spy }, orgId, ids, {
          dates: MAY,
          now: NOW,
        })
        expect(r.byUser.size).toBe(ids.length)
        return queries
      }
      const few = await count(players.slice(0, 3))
      const many = await count(players)
      expect(many).toBe(few)
      expect(many).toBeLessThanOrEqual(5)
    })
  })
})

describe('PlayersStatsQuery', () => {
  it('is off by default and accepts stats with or without a period', () => {
    expect(PlayersStatsQuery.parse({}).stats).toBe(false)
    expect(PlayersStatsQuery.parse({ stats: '1' }).stats).toBe(true)
    expect(
      PlayersStatsQuery.parse({ stats: '1', from: '2026-05-01', to: '2026-05-31' }),
    ).toMatchObject({ from: '2026-05-01', to: '2026-05-31' })
  })

  it('rejects half a period, an inverted period and one longer than a year', () => {
    for (const q of [
      { stats: '1', from: '2026-05-01' },
      { stats: '1', to: '2026-05-01' },
      { stats: '1', from: '2026-05-31', to: '2026-05-01' },
      { stats: '1', from: '2026-01-01', to: '2027-06-01' },
      { stats: 'yes' },
    ])
      expect(PlayersStatsQuery.safeParse(q).success).toBe(false)
  })
})
