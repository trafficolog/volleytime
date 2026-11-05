import {
  bookings,
  closeDb,
  db,
  events,
  organizationMembers,
  organizations,
  and,
  eq,
  sql,
  users,
} from '@volley-time/db'
import { overviewPeriods, resolveReportPeriod } from '@volley-time/shared'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'

import { ledgerService } from '../ledger/service'
import { levelService } from '../levels/service'
import { memberService } from '../members/service'
import { organizationService } from '../organizations/service'
import { overviewService } from '../overview/service'

import { ReportExportQuery, ReportPeriodQuery } from './schemas'
import { ReportExportTooLargeError, reportsService } from './service'

/**
 * Task 21.2.7: отчёты кабинета. Деньги сходятся с кассой и обзором, границы периода — в зоне
 * группы (Europe/Minsk, UTC+3), чужая группа в цифры не попадает.
 */
describe('reportsService (integration)', { timeout: 60_000 }, () => {
  let owner: number
  let orgId: number
  let otherOrg: number
  let otherOwner: number
  let seq = 0

  const ctx = (userId: number) => ({ userId })
  const at = (iso: string) => new Date(iso)
  const MAY = { from: '2026-05-01', to: '2026-05-31' }
  const mayPeriod = () => resolveReportPeriod(MAY.from, MAY.to, 'Europe/Minsk')!
  const newUser = async (label: string, extra: Partial<typeof users.$inferInsert> = {}) =>
    (
      await db
        .insert(users)
        .values({ email: `rep-${label}-${++seq}@t.by`, name: label, ...extra })
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
    db
      .insert(bookings)
      .values({ eventId, userId, organizationId: org, status, method: 'free', seats })
  const entry = (
    type: 'income' | 'expense',
    amount: number,
    occurredAt: string,
    extra: { category?: 'rent' | 'salary' | 'coach' | 'other_income'; currency?: string } = {},
    org = orgId,
  ) =>
    ledgerService.createEntry(ctx(owner), {
      organizationId: org,
      type,
      category: extra.category ?? (type === 'income' ? 'other_income' : 'rent'),
      amount,
      occurredAt: at(occurredAt),
      ...(extra.currency && { currency: extra.currency }),
    })
  const report = (dates = MAY, org = orgId) =>
    reportsService.getManagerReport(ctx(owner), org, dates)

  beforeEach(async () => {
    await db.delete(organizations)
    await db.delete(users)
    owner = await newUser('owner')
    orgId = (await organizationService.create(ctx(owner), { name: 'Отчёты А' })).id
    otherOwner = await newUser('owner-b')
    otherOrg = (await organizationService.create(ctx(otherOwner), { name: 'Отчёты Б' })).id
  })
  afterAll(async () => {
    await db.delete(organizations)
    await db.delete(users)
    await closeDb()
  })

  describe('money', () => {
    it('matches the cash desk totals for the same period and balances income minus expense', async () => {
      await entry('income', 10_000, '2026-05-05T10:00:00Z')
      await entry('income', 2_500, '2026-05-20T10:00:00Z')
      await entry('expense', 4_200, '2026-05-06T10:00:00Z')
      await entry('income', 99_900, '2026-06-20T10:00:00Z') // вне периода
      const r = await report()
      const cash = await ledgerService.getPeriodTotals(ctx(owner), orgId, mayPeriod())
      expect(r.money.income).toBe(cash.income)
      expect(r.money.expense).toBe(cash.expense)
      expect(r.money).toMatchObject({ income: 12_500, expense: 4_200, net: 8_300 })
      expect(r.currency).toBe(cash.currency)
    })

    it('puts the boundary operations in the group zone: May 1 00:00 Minsk is in, June 1 00:00 is out', async () => {
      await entry('income', 100, '2026-04-30T20:59:59Z') // 30 апр 23:59:59 по Минску
      await entry('income', 200, '2026-04-30T21:00:00Z') // 1 мая 00:00:00
      await entry('income', 400, '2026-05-31T20:59:59Z') // 31 мая 23:59:59
      await entry('income', 800, '2026-05-31T21:00:00Z') // 1 июня 00:00:00
      expect((await report()).money.income).toBe(600)
    })

    it('splits the period into buckets whose sums equal the period totals and the cash desk', async () => {
      await entry('income', 1_000, '2026-05-02T10:00:00Z')
      await entry('income', 2_000, '2026-05-11T10:00:00Z')
      await entry('expense', 500, '2026-05-12T10:00:00Z')
      await entry('income', 4_000, '2026-05-31T10:00:00Z')
      const r = await report()
      expect(r.money.buckets.map((b) => b.fromDate)).toEqual([
        '2026-05-01',
        '2026-05-04',
        '2026-05-11',
        '2026-05-18',
        '2026-05-25',
      ])
      expect(r.money.buckets.reduce((a, b) => a + b.income, 0)).toBe(r.money.income)
      expect(r.money.buckets.reduce((a, b) => a + b.expense, 0)).toBe(r.money.expense)
      for (const b of r.money.buckets) {
        const cash = await ledgerService.getPeriodTotals(ctx(owner), orgId, {
          from: new Date(b.from),
          to: new Date(b.to),
        })
        expect(b).toMatchObject({ income: cash.income, expense: cash.expense })
      }
    })

    it('matches the overview week row for the same Monday-to-Sunday range', async () => {
      await entry('income', 3_000, '2026-05-12T10:00:00Z')
      await entry('expense', 700, '2026-05-14T10:00:00Z')
      const now = at('2026-05-14T12:00:00Z')
      const week = overviewPeriods(now, 'Europe/Minsk').weeks[3]!
      const overview = await overviewService.getManagerOverview(ctx(owner), orgId, now)
      const r = await report({ from: '2026-05-11', to: '2026-05-17' })
      expect(week.from.toISOString()).toBe(r.money.buckets[0]!.from)
      expect(r.money).toMatchObject({
        income: overview.cashWeekly.weeks[3]!.income,
        expense: overview.cashWeekly.weeks[3]!.expense,
        net: overview.cashWeekly.weeks[3]!.net,
      })
    })

    it('groups expenses by category with the sum equal to total expense, historical salary apart from coach', async () => {
      await entry('expense', 4_200, '2026-05-02T10:00:00Z', { category: 'rent' })
      await entry('expense', 1_000, '2026-05-03T10:00:00Z', { category: 'rent' })
      await entry('expense', 3_000, '2026-05-04T10:00:00Z', { category: 'salary' })
      await entry('expense', 2_000, '2026-05-05T10:00:00Z', { category: 'coach' })
      await entry('income', 9_000, '2026-05-05T10:00:00Z')
      const r = await report()
      expect(r.money.expenseByCategory).toEqual([
        { category: 'rent', amount: 5_200, count: 2 },
        { category: 'salary', amount: 3_000, count: 1 },
        { category: 'coach', amount: 2_000, count: 1 },
      ])
      expect(r.money.expenseByCategory.reduce((a, c) => a + c.amount, 0)).toBe(r.money.expense)
    })

    it('counts refunds as expense in both the totals and the category breakdown', async () => {
      await ledgerService.createEntry(ctx(owner), {
        organizationId: orgId,
        type: 'expense',
        category: 'refund',
        amount: 1_500,
        occurredAt: at('2026-05-09T10:00:00Z'),
      })
      const r = await report()
      expect(r.money.expense).toBe(1_500)
      expect(r.money.expenseByCategory).toEqual([{ category: 'refund', amount: 1_500, count: 1 }])
    })

    it('ignores entries in another currency, like the cash desk', async () => {
      await entry('income', 1_000, '2026-05-05T10:00:00Z')
      await entry('income', 777_000, '2026-05-05T10:00:00Z', { currency: 'USD' })
      await entry('expense', 555_000, '2026-05-05T10:00:00Z', { currency: 'USD' })
      const r = await report()
      expect(r.money).toMatchObject({ income: 1_000, expense: 0 })
      expect(r.money.expenseByCategory).toEqual([])
    })

    it('does not leak another group money', async () => {
      await entry('income', 5_000, '2026-05-05T10:00:00Z', {}, otherOrg)
      await entry('expense', 2_000, '2026-05-05T10:00:00Z', {}, otherOrg)
      const r = await report()
      expect(r.money).toMatchObject({ income: 0, expense: 0, net: 0 })
      expect(r.money.expenseByCategory).toEqual([])
      expect((await report(MAY, otherOrg)).money).toMatchObject({ income: 5_000, expense: 2_000 })
    })
  })

  describe('occupancy', () => {
    it('matches the overview for the same month and ignores drafts, cancelled events and the queue', async () => {
      const a = await insertEvent('2026-05-10T10:00:00Z', { capacity: 10 })
      const b = await insertEvent('2026-05-12T10:00:00Z', { capacity: 10 })
      const draft = await insertEvent('2026-05-13T10:00:00Z', { status: 'draft', capacity: 50 })
      const cancelled = await insertEvent('2026-05-14T10:00:00Z', {
        status: 'cancelled',
        capacity: 50,
      })
      const outside = await insertEvent('2026-06-14T10:00:00Z', { capacity: 40 })
      await book(a.id, await newUser('p1'), 'confirmed', 3)
      await book(a.id, await newUser('p2'), 'attended', 2)
      await book(a.id, await newUser('p3'), 'waitlisted', 5)
      await book(a.id, await newUser('p4'), 'cancelled', 4)
      await book(b.id, await newUser('p5'), 'pending_payment', 1)
      await book(b.id, await newUser('p6'), 'no_show', 1)
      for (const e of [draft, cancelled, outside])
        await book(e.id, await newUser('x'), 'confirmed', 9)

      const r = await report()
      expect(r.occupancy).toMatchObject({ events: 2, seats: 7, capacity: 20, percent: 35 })
      const overview = await overviewService.getManagerOverview(
        ctx(owner),
        orgId,
        at('2026-05-15T10:00:00Z'),
      )
      expect(r.occupancy.events).toBe(overview.events.thisMonth)
      expect(r.occupancy.seats).toBe(overview.bookings.seats)
      expect(r.occupancy.capacity).toBe(overview.bookings.capacity)
      expect(r.occupancy.percent).toBe(overview.bookings.occupancyPercent)
    })

    it('is null without events and reports the previous period of the same length', async () => {
      expect((await report()).occupancy.percent).toBeNull()
      const prev = await insertEvent('2026-04-10T10:00:00Z', { capacity: 4 })
      await book(prev.id, await newUser('p'), 'confirmed', 3)
      const r = await report()
      expect(r.previous).toEqual({ from: '2026-03-31', to: '2026-04-30' })
      expect(r.occupancy.previous).toMatchObject({ events: 1, seats: 3, capacity: 4, percent: 75 })
    })

    it('does not count another group events or bookings', async () => {
      const foreign = await insertEvent('2026-05-10T10:00:00Z', {}, otherOrg, otherOwner)
      await book(foreign.id, await newUser('f'), 'confirmed', 5, otherOrg)
      expect((await report()).occupancy).toMatchObject({ events: 0, seats: 0, capacity: 0 })
    })
  })

  describe('attendance', () => {
    it('aggregates visits, seats, no-shows, cancellations and the last visit per player', async () => {
      const artem = await newUser('Артём', { telegramUsername: 'artem' })
      const masha = await newUser('Маша')
      await memberService.add(ctx(owner), { organizationId: orgId, userId: artem })
      await db
        .update(organizationMembers)
        .set({ level: 'v1' })
        .where(
          and(eq(organizationMembers.userId, artem), eq(organizationMembers.organizationId, orgId)),
        )
      const e1 = await insertEvent('2026-05-04T10:00:00Z')
      const e2 = await insertEvent('2026-05-11T10:00:00Z')
      const e3 = await insertEvent('2026-05-18T10:00:00Z')
      await book(e1.id, artem, 'attended', 2)
      await book(e2.id, artem, 'attended', 1)
      await book(e3.id, artem, 'no_show')
      await book(e1.id, masha, 'attended')
      await book(e2.id, masha, 'cancelled')
      await book(e3.id, masha, 'confirmed') // не отмечена: не визит и не неявка

      const rows = await reportsService.getPlayerAttendance(ctx(owner), orgId, mayPeriod())
      expect(rows).toEqual([
        {
          userId: artem,
          name: 'Артём',
          telegramUsername: 'artem',
          level: 'v1',
          visits: 2,
          seats: 3,
          noShows: 1,
          cancellations: 0,
          lastVisitAt: '2026-05-11T10:00:00.000Z',
        },
        {
          userId: masha,
          name: 'Маша',
          telegramUsername: null,
          level: null,
          visits: 1,
          seats: 1,
          noShows: 0,
          cancellations: 1,
          lastVisitAt: '2026-05-04T10:00:00.000Z',
        },
      ])
      const r = await report()
      expect(r.attendance).toMatchObject({ visits: 3, noShows: 1, cancellations: 1 })
      expect(r.attendance.top.map((p) => p.userId)).toEqual([artem, masha])
    })

    it('keeps the period edges in the group zone and skips draft and cancelled events', async () => {
      const p = await newUser('p')
      const inEdge = await insertEvent('2026-04-30T21:00:00Z') // 1 мая 00:00 по Минску
      const outEdge = await insertEvent('2026-05-31T21:00:00Z') // 1 июня 00:00
      const before = await insertEvent('2026-04-30T20:59:00Z')
      const draft = await insertEvent('2026-05-10T10:00:00Z', { status: 'draft' })
      const cancelled = await insertEvent('2026-05-11T10:00:00Z', { status: 'cancelled' })
      for (const e of [inEdge, outEdge, before, draft, cancelled]) await book(e.id, p, 'attended')
      const rows = await reportsService.getPlayerAttendance(ctx(owner), orgId, mayPeriod())
      expect(rows).toHaveLength(1)
      expect(rows[0]).toMatchObject({ visits: 1, lastVisitAt: '2026-04-30T21:00:00.000Z' })
    })

    it('returns nothing for a player without bookings and honours the userIds batch filter', async () => {
      const a = await newUser('a')
      const b = await newUser('b')
      const e = await insertEvent('2026-05-10T10:00:00Z')
      await book(e.id, a, 'attended')
      await book(e.id, b, 'attended')
      expect(
        await reportsService.getPlayerAttendance(ctx(owner), orgId, mayPeriod(), { userIds: [] }),
      ).toEqual([])
      const only = await reportsService.getPlayerAttendance(ctx(owner), orgId, mayPeriod(), {
        userIds: [b, await newUser('never-booked')],
      })
      expect(only.map((p) => p.userId)).toEqual([b])
    })

    it('does not leak another group bookings, even of the same user', async () => {
      const shared = await newUser('shared')
      const mine = await insertEvent('2026-05-10T10:00:00Z')
      const foreign = await insertEvent('2026-05-10T10:00:00Z', {}, otherOrg, otherOwner)
      await book(mine.id, shared, 'attended')
      await book(foreign.id, shared, 'attended', 1, otherOrg)
      await book(foreign.id, shared, 'no_show', 1, otherOrg).catch(() => undefined)
      const rows = await reportsService.getPlayerAttendance(ctx(owner), orgId, mayPeriod())
      expect(rows).toHaveLength(1)
      expect(rows[0]).toMatchObject({ visits: 1, noShows: 0 })
    })

    it('ranks the top by visits and only lists players who visited', async () => {
      const more = await newUser('more')
      const less = await newUser('less')
      const none = await newUser('none')
      const e1 = await insertEvent('2026-05-04T10:00:00Z')
      const e2 = await insertEvent('2026-05-05T10:00:00Z')
      await book(e1.id, less, 'attended')
      await book(e1.id, more, 'attended')
      await book(e2.id, more, 'attended')
      await book(e1.id, none, 'no_show')
      const r = await report()
      expect(r.attendance.top.map((p) => p.userId)).toEqual([more, less])
    })
  })

  describe('export', () => {
    it('exports finance rows equal to the cash desk journal for the same period, in the group zone', async () => {
      await entry('income', 4_250, '2026-05-05T10:00:00Z')
      await entry('expense', 1_000, '2026-04-30T21:30:00Z') // 1 мая 00:30 по Минску
      await entry('expense', 9_000, '2026-04-30T20:30:00Z') // вне периода
      const out = await reportsService.buildExport(ctx(owner), orgId, { type: 'finance', ...MAY })
      const journal = await ledgerService.listForExport(ctx(owner), orgId, mayPeriod())
      expect(out.rows).toHaveLength(journal.length)
      expect(out.columns.map((c) => c.key)).toEqual([
        'date',
        'type',
        'category',
        'description',
        'event',
        'method',
        'amount',
        'currency',
        'payer',
      ])
      expect(out.rows.map((r) => [r[0], r[1], r[6]])).toEqual([
        ['05.05.2026 13:00', 'Поступление', '42,50'],
        ['01.05.2026 00:30', 'Расход', '10,00'],
      ])
      expect(out.csv.startsWith('\uFEFFДата;Тип;Категория')).toBe(true)
    })

    it('honours the chosen columns in the layout order and exports attendance by player', async () => {
      const p = await newUser('Артём')
      await memberService.add(ctx(owner), { organizationId: orgId, userId: p })
      await db
        .update(organizationMembers)
        .set({ level: 'v1' })
        .where(
          and(eq(organizationMembers.userId, p), eq(organizationMembers.organizationId, orgId)),
        )
      const e = await insertEvent('2026-05-04T10:00:00Z')
      await book(e.id, p, 'attended', 2)
      const out = await reportsService.buildExport(ctx(owner), orgId, {
        type: 'attendance',
        ...MAY,
        columns: ['visits', 'player', 'level'],
      })
      const [v1] = await levelService.list(ctx(owner))
      expect(out.columns.map((c) => c.label)).toEqual(['Игрок', 'Тренировок', 'Уровень'])
      expect(out.rows).toEqual([['Артём', '1', v1!.title]])
      expect(out.csv).toBe(`\uFEFFИгрок;Тренировок;Уровень\r\nАртём;1;${v1!.title}\r\n`)
    })

    it('neutralises spreadsheet formulas in exported text', async () => {
      await ledgerService.createEntry(ctx(owner), {
        organizationId: orgId,
        type: 'expense',
        category: 'other',
        amount: 100,
        description: '=HYPERLINK("http://x")',
        occurredAt: at('2026-05-05T10:00:00Z'),
      })
      const out = await reportsService.buildExport(ctx(owner), orgId, {
        type: 'finance',
        ...MAY,
        columns: ['description'],
      })
      expect(out.csv).toContain(`"'=HYPERLINK(""http://x"")"`)
    })

    it('does not export another group rows', async () => {
      await entry('income', 5_000, '2026-05-05T10:00:00Z', {}, otherOrg)
      const out = await reportsService.buildExport(ctx(owner), orgId, { type: 'finance', ...MAY })
      expect(out.rows).toEqual([])
    })

    it('refuses an export over the row limit', async () => {
      await db.execute(
        // 5001 запись одним запросом
        sql`INSERT INTO ledger_entries (organization_id, type, category, amount, currency, occurred_at)
          SELECT ${orgId}, 'income', 'other_income', 100, 'BYN', '2026-05-05T10:00:00Z'::timestamptz FROM generate_series(1, 5001)`,
      )
      await expect(
        reportsService.buildExport(ctx(owner), orgId, { type: 'finance', ...MAY }),
      ).rejects.toBeInstanceOf(ReportExportTooLargeError)
    })
  })

  describe('query schemas', () => {
    it('validates the period and the export columns', () => {
      expect(ReportPeriodQuery.safeParse(MAY).success).toBe(true)
      expect(ReportPeriodQuery.safeParse({ from: '2026-05-31', to: '2026-05-01' }).success).toBe(
        false,
      )
      expect(ReportPeriodQuery.safeParse({ from: '2026-01-01', to: '2027-01-02' }).success).toBe(
        false,
      )
      expect(ReportPeriodQuery.safeParse({ from: 'x', to: '2026-05-01' }).success).toBe(false)
      const ok = ReportExportQuery.parse({
        type: 'finance',
        ...MAY,
        columns: 'date,amount',
        preview: '1',
      })
      expect(ok).toMatchObject({ columns: ['date', 'amount'], preview: true })
      expect(
        ReportExportQuery.safeParse({ type: 'finance', ...MAY, columns: 'player' }).success,
      ).toBe(false)
      expect(ReportExportQuery.safeParse({ type: 'subs', ...MAY }).success).toBe(false)
    })
  })
})
