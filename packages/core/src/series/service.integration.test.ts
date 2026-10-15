import {
  and,
  appendEventBalanceEntry,
  asc,
  auditLog,
  bookings,
  closeDb,
  db,
  eq,
  eventBalanceEntries,
  events,
  eventSeries,
  organizationEventBalances,
  organizations,
  payments,
  sql,
  users,
} from '@volley-time/db'
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { auditService } from '../audit/service'
import { bookingService } from '../bookings/service'
import { eventService } from '../events/service'
import { memberService } from '../members/service'
import { organizationService } from '../organizations/service'
import { venueService } from '../venues/service'

import { planSeriesDates, seriesService } from './service'

let ownerId: number
let playerId: number
let orgId: number
let venueId: number
const previousFlag = process.env.EVENT_BALANCE_ENFORCED

const owner = () => ({ userId: ownerId })

async function balance() {
  const [row] = await db
    .select()
    .from(organizationEventBalances)
    .where(eq(organizationEventBalances.organizationId, orgId))
  return row?.balance ?? 0
}

async function setBalance(n: number) {
  const delta = n - (await balance())
  if (delta === 0) return
  await db.transaction((tx) =>
    appendEventBalanceEntry(tx, {
      organizationId: orgId,
      delta,
      reason: 'correction',
      actor: { kind: 'user', userId: ownerId },
      comment: 'test setup',
    }),
  )
}

async function entries(reason: 'spend' | 'refund') {
  return db
    .select()
    .from(eventBalanceEntries)
    .where(
      and(eq(eventBalanceEntries.organizationId, orgId), eq(eventBalanceEntries.reason, reason)),
    )
}

/** Проекция = сумма журнала по каждой группе. */
async function drift() {
  return db.execute(sql`
    SELECT o.id FROM organizations o
    LEFT JOIN organization_event_balances b ON b.organization_id = o.id
    LEFT JOIN (SELECT organization_id, sum(delta)::int AS s FROM event_balance_entries GROUP BY 1) e
      ON e.organization_id = o.id
    WHERE coalesce(b.balance, 0) <> coalesce(e.s, 0)`)
}

async function seriesEvents(seriesId: number) {
  return db
    .select()
    .from(events)
    .where(eq(events.seriesId, seriesId))
    .orderBy(asc(events.seriesDate), asc(events.id))
}

const template = (extra: Record<string, unknown> = {}) => ({
  title: 'Тренировка по средам',
  startTime: '19:00',
  durationMinutes: 120,
  capacity: 12,
  price: 1500,
  ...extra,
})

const weekly = (count: number, extra: Record<string, unknown> = {}) => ({
  rule: { freq: 'weekly' as const, weekdays: [3], startDate: '2027-01-04', count },
  template: template(),
  ...extra,
})

const codeOf = (r: PromiseSettledResult<unknown>) =>
  r.status === 'rejected' ? ((r.reason as { code?: string }).code ?? String(r.reason)) : 'ok'

async function codeOfCall(p: Promise<unknown>) {
  return codeOf((await Promise.allSettled([p]))[0]!)
}

describe('event series (integration, 20.2.2)', () => {
  beforeEach(async () => {
    process.env.EVENT_BALANCE_ENFORCED = 'true'
    await db.delete(organizations)
    await db.delete(users)
    const [u, p] = await db
      .insert(users)
      .values([
        { email: `series-owner-${Math.random()}@t.by`, name: 'Owner' },
        { email: `series-player-${Math.random()}@t.by`, name: 'Player' },
      ])
      .returning()
    ownerId = u!.id
    playerId = p!.id
    orgId = (await organizationService.create(owner(), { name: 'Series' })).id
    await memberService.add(owner(), { organizationId: orgId, userId: playerId })
    venueId = (await venueService.create(owner(), { organizationId: orgId, name: 'Зал' })).id
  })

  afterEach(() => {
    vi.restoreAllMocks()
    if (previousFlag === undefined) delete process.env.EVENT_BALANCE_ENFORCED
    else process.env.EVENT_BALANCE_ENFORCED = previousFlag
  })

  afterAll(async () => {
    await db.delete(organizations)
    await db.delete(users)
    await closeDb()
  })

  describe('preview', () => {
    it('returns dates, published vs drafts and balance after, and writes nothing', async () => {
      await setBalance(3)
      const before = await db.select().from(auditLog)
      const preview = await seriesService.preview(owner(), orgId, {
        ...weekly(5),
        exceptions: ['2027-01-13'],
      })
      expect(preview.dates.map((d) => d.date)).toEqual([
        '2027-01-06',
        '2027-01-20',
        '2027-01-27',
        '2027-02-03',
      ])
      expect(preview.excluded).toEqual(['2027-01-13'])
      expect(preview).toMatchObject({
        timezone: 'Europe/Minsk',
        total: 4,
        published: 3,
        drafts: 1,
        venueConflicts: 0,
        balanceEnforced: true,
        balanceBefore: 3,
        balanceAfter: 0,
      })
      expect(preview.dates.map((d) => d.status)).toEqual([
        'published',
        'published',
        'published',
        'draft',
      ])
      expect(preview.dates[3]!.draftReason).toBe('balance')
      // 19:00 по Минску = 16:00 UTC
      expect(preview.dates[0]!.startsAt).toBe('2027-01-06T16:00:00.000Z')
      expect(preview.dates[0]!.endsAt).toBe('2027-01-06T18:00:00.000Z')

      expect(await db.select().from(eventSeries)).toHaveLength(0)
      expect(await db.select().from(events)).toHaveLength(0)
      expect(await balance()).toBe(3)
      expect(await db.select().from(auditLog)).toHaveLength(before.length)
    })

    it('with balance enforcement off publishes every date and keeps the balance', async () => {
      process.env.EVENT_BALANCE_ENFORCED = 'false'
      await setBalance(1)
      const preview = await seriesService.preview(owner(), orgId, weekly(3))
      expect(preview).toMatchObject({
        published: 3,
        drafts: 0,
        balanceEnforced: false,
        balanceBefore: 1,
        balanceAfter: 1,
      })
    })
  })

  describe('create (D-04)', () => {
    it('creates a 52-date series in one operation; preview matches the result', async () => {
      await setBalance(60)
      const preview = await seriesService.preview(owner(), orgId, weekly(52))
      const result = await seriesService.create(owner(), orgId, weekly(52))
      expect(result).toMatchObject({
        total: 52,
        published: 52,
        drafts: 0,
        balanceAfter: 8,
        replayed: false,
      })
      expect({ p: preview.published, d: preview.drafts, b: preview.balanceAfter }).toEqual({
        p: result.published,
        d: result.drafts,
        b: result.balanceAfter,
      })
      const rows = await seriesEvents(result.series.id)
      expect(rows).toHaveLength(52)
      expect(rows.every((e) => e.status === 'published' && e.organizationId === orgId)).toBe(true)
      expect(rows[0]!.seriesDate).toBe('2027-01-06')
      expect(rows.map((e) => e.startsAt.toISOString())).toEqual(
        preview.dates.map((d) => d.startsAt),
      )
      expect(await entries('spend')).toHaveLength(52)
      expect(await balance()).toBe(8)
      expect((await drift()).length).toBe(0)
      const [series] = await db.select().from(eventSeries)
      expect(series).toMatchObject({
        organizationId: orgId,
        timezone: 'Europe/Minsk',
        status: 'active',
      })
    })

    it('short balance: the first N dates are published, the rest are drafts', async () => {
      await setBalance(3)
      const preview = await seriesService.preview(owner(), orgId, weekly(5))
      const result = await seriesService.create(owner(), orgId, weekly(5))
      expect(result).toMatchObject({ total: 5, published: 3, drafts: 2, balanceAfter: 0 })
      expect({ p: preview.published, d: preview.drafts, b: preview.balanceAfter }).toEqual({
        p: 3,
        d: 2,
        b: 0,
      })
      const rows = await seriesEvents(result.series.id)
      expect(rows.map((e) => e.status)).toEqual([
        'published',
        'published',
        'published',
        'draft',
        'draft',
      ])
      const spends = await entries('spend')
      expect(spends.map((s) => s.eventId).sort()).toEqual(
        rows
          .slice(0, 3)
          .map((e) => e.id)
          .sort(),
      )
      expect(await balance()).toBe(0)
      expect((await drift()).length).toBe(0)
    })

    it('zero balance: the whole series is created as drafts', async () => {
      await setBalance(0)
      const result = await seriesService.create(owner(), orgId, weekly(3))
      expect(result).toMatchObject({ published: 0, drafts: 3, balanceAfter: 0 })
    })

    it('a failure in the middle creates nothing (series, events, balance, journal)', async () => {
      await setBalance(10)
      const auditBefore = (await db.select().from(auditLog)).length
      const real = auditService.record.bind(auditService)
      let calls = 0
      vi.spyOn(auditService, 'record').mockImplementation(async (ctx, params) => {
        calls += 1
        if (calls === 3) throw new Error('boom')
        return real(ctx, params)
      })
      expect(await codeOfCall(seriesService.create(owner(), orgId, weekly(5)))).toBe('Error: boom')
      expect(await db.select().from(eventSeries)).toHaveLength(0)
      expect(await db.select().from(events)).toHaveLength(0)
      expect(await entries('spend')).toHaveLength(0)
      expect(await balance()).toBe(10)
      expect(await db.select().from(auditLog)).toHaveLength(auditBefore)
    })

    it('venue conflict makes a date a draft regardless of the balance', async () => {
      await setBalance(10)
      // занято событием группы в том же зале, пересекается с 13.01 19:00–21:00 Минск
      await eventService.create(owner(), orgId, {
        title: 'Чужая игра',
        venueId,
        startsAt: new Date('2027-01-13T17:30:00Z'),
        endsAt: new Date('2027-01-13T19:00:00Z'),
        capacity: 8,
      })
      // отменённое и стык по границе не конфликтуют
      const cancelled = await eventService.create(owner(), orgId, {
        title: 'Отменено',
        venueId,
        startsAt: new Date('2027-01-20T16:00:00Z'),
        endsAt: new Date('2027-01-20T18:00:00Z'),
        capacity: 8,
      })
      await eventService.cancel(owner(), cancelled.id)
      await eventService.create(owner(), orgId, {
        title: 'Стык',
        venueId,
        startsAt: new Date('2027-01-06T18:00:00Z'),
        endsAt: new Date('2027-01-06T19:00:00Z'),
        capacity: 8,
      })
      const before = await balance()
      const input = weekly(3, { template: template({ venueId }) })
      const preview = await seriesService.preview(owner(), orgId, input)
      expect(preview.dates.map((d) => [d.date, d.status, d.draftReason])).toEqual([
        ['2027-01-06', 'published', null],
        ['2027-01-13', 'draft', 'venue_conflict'],
        ['2027-01-20', 'published', null],
      ])
      expect(preview).toMatchObject({ published: 2, drafts: 1, venueConflicts: 1 })
      const result = await seriesService.create(owner(), orgId, input)
      expect(result).toMatchObject({ published: 2, drafts: 1, venueConflicts: 1 })
      expect(await balance()).toBe(before - 2)

      // без зала конфликта нет
      const free = await seriesService.preview(owner(), orgId, weekly(3))
      expect(free.venueConflicts).toBe(0)
    })

    it('adjacent dates of the same series do not conflict with each other', async () => {
      await setBalance(10)
      const preview = await seriesService.preview(owner(), orgId, {
        rule: { freq: 'weekly', weekdays: [1, 2], startDate: '2027-01-04', count: 2 },
        template: template({ venueId, startTime: '00:00', durationMinutes: 1440 }),
      })
      expect(preview.dates.map((d) => d.status)).toEqual(['published', 'published'])
    })

    it('planner: a date overlapping an earlier date of the same series becomes a draft', () => {
      const at = (h: number) => new Date(Date.UTC(2027, 0, 4, h))
      const plan = planSeriesDates(
        [
          { date: '2027-01-04', startsAt: at(10), endsAt: at(14) },
          { date: '2027-01-05', startsAt: at(12), endsAt: at(16) },
          { date: '2027-01-06', startsAt: at(20), endsAt: at(22) },
          { date: '2027-01-07', startsAt: at(23), endsAt: at(24) },
        ],
        { venueId: 1, busy: [{ startsAt: at(21), endsAt: at(23) }] },
        { enforced: true, balance: 1 },
      )
      expect(plan.map((d) => [d.status, d.draftReason])).toEqual([
        ['published', null],
        ['draft', 'venue_conflict'],
        ['draft', 'venue_conflict'],
        ['draft', 'balance'],
      ])
    })

    it('keeps local wall time across DST in the group timezone', async () => {
      await db
        .update(organizations)
        .set({ defaultTimezone: 'Europe/Berlin' })
        .where(eq(organizations.id, orgId))
      await setBalance(10)
      const result = await seriesService.create(owner(), orgId, {
        rule: { freq: 'weekly', weekdays: [3], startDate: '2027-03-22', count: 2 },
        template: template(),
      })
      const rows = await seriesEvents(result.series.id)
      // 24.03 — UTC+1, 31.03 — UTC+2 (переход 28.03.2027)
      expect(rows.map((e) => e.startsAt.toISOString())).toEqual([
        '2027-03-24T18:00:00.000Z',
        '2027-03-31T17:00:00.000Z',
      ])
      expect(result.series.timezone).toBe('Europe/Berlin')
    })

    it.each([
      [
        'series.too_many_dates',
        {
          rule: {
            freq: 'weekly',
            weekdays: [1, 2, 3, 4, 5, 6, 7],
            startDate: '2027-01-01',
            count: 366,
          },
          exceptions: [],
          template: template(),
          // 366 повторений ровно в лимите — превышение даёт until
        },
      ],
      [
        'series.invalid_rule',
        {
          rule: { freq: 'weekly', weekdays: [], startDate: '2027-01-01', count: 3 },
          template: template(),
        },
      ],
      [
        'event.starts_in_past',
        { rule: { freq: 'once', weekdays: [], startDate: '2020-01-01' }, template: template() },
      ],
    ])('rejects %s', async (code, input) => {
      const run = (i: unknown) => seriesService.create(owner(), orgId, i as never)
      if (code === 'series.too_many_dates') {
        expect(await codeOfCall(run(input))).toBe('ok')
        expect(
          await codeOfCall(
            seriesService.preview(owner(), orgId, {
              rule: {
                freq: 'weekly',
                weekdays: [1, 2, 3, 4, 5, 6, 7],
                startDate: '2027-01-01',
                until: '2028-01-02',
              },
              template: template(),
            }),
          ),
        ).toBe(code)
        return
      }
      expect(await codeOfCall(run(input))).toBe(code)
      expect(await codeOfCall(seriesService.preview(owner(), orgId, input as never))).toBe(code)
    })

    it('rejects a venue of another group without writing', async () => {
      const [other] = await db
        .insert(users)
        .values({ email: `other-${Math.random()}@t.by` })
        .returning()
      const otherOrg = await organizationService.create({ userId: other!.id }, { name: 'Other' })
      const foreignVenue = await venueService.create(
        { userId: other!.id },
        { organizationId: otherOrg.id, name: 'Чужой зал' },
      )
      const input = weekly(2, { template: template({ venueId: foreignVenue.id }) })
      expect(await codeOfCall(seriesService.create(owner(), orgId, input))).toBe(
        'event.venue_not_in_org',
      )
      expect(await codeOfCall(seriesService.preview(owner(), orgId, input))).toBe(
        'event.venue_not_in_org',
      )
      expect(await db.select().from(eventSeries)).toHaveLength(0)
    })
  })

  describe('idempotency and races', () => {
    it('a retry with the same key returns the same series without charging again', async () => {
      await setBalance(10)
      const input = weekly(4, { idempotencyKey: 'create-series-0001' })
      const first = await seriesService.create(owner(), orgId, input)
      const retry = await seriesService.create(owner(), orgId, input)
      expect(retry.replayed).toBe(true)
      expect(retry.series.id).toBe(first.series.id)
      expect(retry).toMatchObject({ total: 4, published: 4, drafts: 0, balanceAfter: 6 })
      expect(await db.select().from(eventSeries)).toHaveLength(1)
      expect(await entries('spend')).toHaveLength(4)
      expect(await balance()).toBe(6)
    })

    it('the same key with a different payload is a conflict', async () => {
      await seriesService.create(
        owner(),
        orgId,
        weekly(2, { idempotencyKey: 'create-series-0002' }),
      )
      expect(
        await codeOfCall(
          seriesService.create(owner(), orgId, weekly(3, { idempotencyKey: 'create-series-0002' })),
        ),
      ).toBe('series.idempotency_conflict')
    })

    it('parallel retries with the same key create one series', async () => {
      await setBalance(10)
      const input = weekly(3, { idempotencyKey: 'create-series-0003' })
      const results = await Promise.all(
        Array.from({ length: 5 }, () => seriesService.create(owner(), orgId, input)),
      )
      expect(new Set(results.map((r) => r.series.id)).size).toBe(1)
      expect(results.filter((r) => !r.replayed)).toHaveLength(1)
      expect(await db.select().from(eventSeries)).toHaveLength(1)
      expect(await entries('spend')).toHaveLength(3)
      expect(await balance()).toBe(7)
    })

    it('parallel series creation never overspends the balance', async () => {
      await setBalance(3)
      const results = await Promise.all(
        Array.from({ length: 4 }, (_, i) =>
          seriesService.create(owner(), orgId, {
            rule: { freq: 'weekly', weekdays: [i + 1], startDate: '2027-01-04', count: 4 },
            template: template(),
          }),
        ),
      )
      expect(results.reduce((n, r) => n + r.published, 0)).toBe(3)
      expect(results.reduce((n, r) => n + r.drafts, 0)).toBe(13)
      expect(await balance()).toBe(0)
      expect(await entries('spend')).toHaveLength(3)
      expect((await drift()).length).toBe(0)
    })

    it('parallel publication of series drafts never overspends', async () => {
      await setBalance(0)
      const { series } = await seriesService.create(owner(), orgId, weekly(6))
      const drafts = await seriesEvents(series.id)
      await setBalance(2)
      const results = await Promise.allSettled(
        drafts.map((d) => eventService.update(owner(), d.id, { status: 'published' })),
      )
      const codes = results.map(codeOf)
      expect(codes.filter((c) => c === 'ok')).toHaveLength(2)
      expect(codes.filter((c) => c === 'event_balance.insufficient')).toHaveLength(4)
      expect(await balance()).toBe(0)
      expect((await drift()).length).toBe(0)
    })
  })

  describe('get', () => {
    it('returns the series with its dates; another group gets series.not_found', async () => {
      const { series } = await seriesService.create(owner(), orgId, weekly(2))
      const view = await seriesService.get(owner(), orgId, series.id)
      expect(view.series.id).toBe(series.id)
      expect(view.events.map((e) => e.seriesDate)).toEqual(['2027-01-06', '2027-01-13'])
      const [other] = await db
        .insert(users)
        .values({ email: `other-${Math.random()}@t.by` })
        .returning()
      const otherOrg = await organizationService.create({ userId: other!.id }, { name: 'Other' })
      expect(
        await codeOfCall(seriesService.get({ userId: other!.id }, otherOrg.id, series.id)),
      ).toBe('series.not_found')
    })
  })

  describe('update (this only / this and following)', () => {
    it('following: changes future dates from the given date, keeps earlier and cancelled', async () => {
      await setBalance(10)
      const { series } = await seriesService.create(owner(), orgId, weekly(4))
      const rows = await seriesEvents(series.id)
      await eventService.cancel(owner(), rows[3]!.id)
      const result = await seriesService.update(
        owner(),
        orgId,
        series.id,
        { scope: 'following', from: '2027-01-13' },
        { startTime: '20:30', durationMinutes: 90, capacity: 14, title: 'Новое время' },
      )
      expect(result.updated).toBe(2)
      const after = await seriesEvents(series.id)
      expect(after[0]).toMatchObject({ title: 'Тренировка по средам', capacity: 12 })
      expect(after[0]!.startsAt.toISOString()).toBe('2027-01-06T16:00:00.000Z')
      expect(after[1]).toMatchObject({ title: 'Новое время', capacity: 14 })
      expect(after[1]!.startsAt.toISOString()).toBe('2027-01-13T17:30:00.000Z')
      expect(after[1]!.endsAt.toISOString()).toBe('2027-01-13T19:00:00.000Z')
      expect(after[2]!.startsAt.toISOString()).toBe('2027-01-20T17:30:00.000Z')
      expect(after[3]).toMatchObject({ status: 'cancelled', title: 'Тренировка по средам' })
      const [stored] = await db.select().from(eventSeries).where(eq(eventSeries.id, series.id))
      expect(stored!.template).toMatchObject({ startTime: '20:30', durationMinutes: 90 })
      // правка не трогает баланс
      expect(await entries('spend')).toHaveLength(4)
    })

    it('single: changes only that date and leaves the series template', async () => {
      const { series } = await seriesService.create(owner(), orgId, weekly(3))
      const result = await seriesService.update(
        owner(),
        orgId,
        series.id,
        { scope: 'single', from: '2027-01-13' },
        { capacity: 20 },
      )
      expect(result.updated).toBe(1)
      expect((await seriesEvents(series.id)).map((e) => e.capacity)).toEqual([12, 20, 12])
      const [stored] = await db.select().from(eventSeries).where(eq(eventSeries.id, series.id))
      expect(stored!.template).toMatchObject({ capacity: 12 })
      expect(
        await codeOfCall(
          seriesService.update(
            owner(),
            orgId,
            series.id,
            { scope: 'single', from: '2027-02-24' },
            {
              capacity: 20,
            },
          ),
        ),
      ).toBe('event.not_found')
    })

    it('is atomic: one date that cannot change rolls back the whole edit', async () => {
      await setBalance(10)
      const { series } = await seriesService.create(owner(), orgId, weekly(3))
      const rows = await seriesEvents(series.id)
      await db.update(events).set({ capacity: 2 }).where(eq(events.id, rows[2]!.id))
      await bookingService.book({ userId: playerId }, orgId, rows[2]!.id, { method: 'cash' })
      await bookingService.book(owner(), orgId, rows[2]!.id, { method: 'cash' })
      expect(
        await codeOfCall(
          seriesService.update(
            owner(),
            orgId,
            series.id,
            { scope: 'following', from: '2027-01-06' },
            {
              capacity: 1,
            },
          ),
        ),
      ).toBe('event.capacity_below_taken')
      expect((await seriesEvents(series.id)).map((e) => e.capacity)).toEqual([12, 12, 2])
    })
  })

  describe('cancel this and following', () => {
    it('cancels the date and all following dates with refunds per D-09/D-13', async () => {
      await setBalance(3)
      const { series } = await seriesService.create(owner(), orgId, weekly(5)) // 3 опубликовано, 2 черновика
      const rows = await seriesEvents(series.id)
      // запись на 3-ю дату блокирует возврат баланса за неё (D-13)
      const booking = await bookingService.book({ userId: playerId }, orgId, rows[2]!.id, {
        method: 'cash',
      })
      const result = await seriesService.cancel(owner(), orgId, series.id, { from: '2027-01-13' })
      expect(result).toMatchObject({ cancelled: 4, balanceRefunds: 1 })
      const after = await seriesEvents(series.id)
      expect(after.map((e) => e.status)).toEqual([
        'published',
        'cancelled',
        'cancelled',
        'cancelled',
        'cancelled',
      ])
      // возврат только за опубликованную дату без записей; за черновики не списывали
      expect((await entries('refund')).map((r) => r.eventId)).toEqual([rows[1]!.id])
      expect(await balance()).toBe(1)
      // запись и её неоплаченный платёж отменены (R0.7)
      const [b] = await db.select().from(bookings).where(eq(bookings.id, booking.id))
      expect(b!.status).toBe('cancelled')
      const [pay] = await db.select().from(payments).where(eq(payments.bookingId, booking.id))
      expect(pay!.status).toBe('cancelled')
      // серия ещё активна: 1-я дата осталась
      const [stored] = await db.select().from(eventSeries).where(eq(eventSeries.id, series.id))
      expect(stored!.status).toBe('active')
      const audit = await db
        .select()
        .from(auditLog)
        .where(
          and(
            eq(auditLog.entityType, 'event_series'),
            eq(auditLog.action, 'event_series.cancelled'),
          ),
        )
      expect(audit).toHaveLength(1)
      expect((await drift()).length).toBe(0)
    })

    it('collects one cancellation notice per cancelled booking for dispatch after commit', async () => {
      await setBalance(10)
      const { series } = await seriesService.create(owner(), orgId, weekly(2))
      const rows = await seriesEvents(series.id)
      await bookingService.book({ userId: playerId }, orgId, rows[1]!.id, { method: 'cash' })
      const notifications: unknown[] = []
      await seriesService.cancel(
        { ...owner(), notifications: notifications as never },
        orgId,
        series.id,
        { from: '2027-01-06' },
      )
      expect(notifications).toHaveLength(1)
      expect(notifications[0]).toMatchObject({ userId: playerId, type: 'event_cancelled' })
    })

    it('is idempotent and ends the series when nothing is left', async () => {
      await setBalance(10)
      const { series } = await seriesService.create(owner(), orgId, weekly(3))
      const first = await seriesService.cancel(owner(), orgId, series.id, { from: '2027-01-06' })
      expect(first).toMatchObject({ cancelled: 3, balanceRefunds: 3 })
      const again = await seriesService.cancel(owner(), orgId, series.id, { from: '2027-01-06' })
      expect(again).toMatchObject({ cancelled: 0, balanceRefunds: 0 })
      const [stored] = await db.select().from(eventSeries).where(eq(eventSeries.id, series.id))
      expect(stored!.status).toBe('ended')
      expect(await entries('refund')).toHaveLength(3)
      expect(await balance()).toBe(10)
    })

    it('parallel cancels of the same series refund each date once', async () => {
      await setBalance(10)
      const { series } = await seriesService.create(owner(), orgId, weekly(4))
      const results = await Promise.all(
        Array.from({ length: 3 }, () =>
          seriesService.cancel(owner(), orgId, series.id, { from: '2027-01-06' }),
        ),
      )
      expect(results.reduce((n, r) => n + r.cancelled, 0)).toBe(4)
      expect(await entries('refund')).toHaveLength(4)
      expect(await balance()).toBe(10)
      expect((await drift()).length).toBe(0)
    })

    it('parallel cancel and booking on a later date stay consistent', async () => {
      for (let round = 0; round < 4; round++) {
        await setBalance(10)
        const { series } = await seriesService.create(owner(), orgId, {
          ...weekly(3),
          rule: { freq: 'weekly', weekdays: [round + 1], startDate: '2027-01-04', count: 3 },
        })
        const rows = await seriesEvents(series.id)
        const [cancel, book] = await Promise.allSettled([
          seriesService.cancel(owner(), orgId, series.id, { from: rows[0]!.seriesDate! }),
          bookingService.book({ userId: playerId }, orgId, rows[2]!.id, { method: 'cash' }),
        ])
        expect(codeOf(cancel)).toBe('ok')
        expect(['ok', 'booking.event_not_bookable']).toContain(codeOf(book))
        const after = await seriesEvents(series.id)
        expect(after.every((e) => e.status === 'cancelled')).toBe(true)
        // ни одной активной записи на отменённых событиях
        const active = await db
          .select()
          .from(bookings)
          .where(and(eq(bookings.eventId, rows[2]!.id), sql`${bookings.status} <> 'cancelled'`))
        expect(active).toHaveLength(0)
        // возврат за 3-ю дату — только если запись не успела (D-13)
        const refunds = (await entries('refund')).filter((r) =>
          rows.some((e) => e.id === r.eventId),
        )
        expect(refunds).toHaveLength(codeOf(book) === 'ok' ? 2 : 3)
        expect((await drift()).length).toBe(0)
      }
    })
  })
})
