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

import { behindEventLock } from '../__tests__/event-lock-barrier'
import { addDays, futureMonday, nextBerlinSpringShift, today } from '../__tests__/series-dates'
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

/** Понедельник через 3+ недели; серии по средам — от него (даты не «протухают»). */
const BASE = futureMonday(3)
/** i-я среда серии `weekly(…)`. */
const wed = (i: number) => addDays(BASE, 2 + 7 * i)
/** 19:00 по Минску = 16:00 UTC. */
const at = (date: string, hhmm = '16:00') => `${date}T${hhmm}:00.000Z`

const owner = () => ({ userId: ownerId })
let keySeq = 0
const key = () => `test-key-${Date.now()}-${keySeq++}`

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

/** Серия по средам от BASE; ключ идемпотентности обязателен для создания. */
const weekly = (count: number, extra: Record<string, unknown> = {}) => ({
  rule: { freq: 'weekly' as const, weekdays: [3], startDate: BASE, count },
  template: template(),
  idempotencyKey: key(),
  ...extra,
})

const codeOf = (r: PromiseSettledResult<unknown>) => {
  if (r.status === 'fulfilled') return 'ok'
  const reason = r.reason as { code?: string; name?: string }
  return reason.code ?? (reason.name === 'ZodError' ? 'ZodError' : String(r.reason))
}

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
        exceptions: [wed(1)],
      })
      expect(preview.dates.map((d) => d.date)).toEqual([wed(0), wed(2), wed(3), wed(4)])
      expect(preview.excluded).toEqual([wed(1)])
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
      expect(preview.dates[0]!.startsAt).toBe(at(wed(0)))
      expect(preview.dates[0]!.endsAt).toBe(at(wed(0), '18:00'))

      expect(await db.select().from(eventSeries)).toHaveLength(0)
      expect(await db.select().from(events)).toHaveLength(0)
      expect(await balance()).toBe(3)
      expect(await db.select().from(auditLog)).toHaveLength(before.length)
    })

    it('does not need an idempotency key', async () => {
      const input: Record<string, unknown> = { ...weekly(2) }
      delete input.idempotencyKey
      expect((await seriesService.preview(owner(), orgId, input as never)).total).toBe(2)
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
    it('requires an idempotency key', async () => {
      const input: Record<string, unknown> = { ...weekly(2) }
      delete input.idempotencyKey
      expect(await codeOfCall(seriesService.create(owner(), orgId, input as never))).toBe(
        'ZodError',
      )
      expect(await db.select().from(eventSeries)).toHaveLength(0)
    })

    it('creates a 52-date series in one operation; preview matches the result', async () => {
      await setBalance(60)
      const input = weekly(52)
      const preview = await seriesService.preview(owner(), orgId, input)
      const result = await seriesService.create(owner(), orgId, input)
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
      expect(rows[0]!.seriesDate).toBe(wed(0))
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
      const input = weekly(5)
      const preview = await seriesService.preview(owner(), orgId, input)
      const result = await seriesService.create(owner(), orgId, input)
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
      // занято событием группы в том же зале, пересекается со 2-й средой 19:00–21:00 Минск
      await eventService.create(owner(), orgId, {
        title: 'Чужая игра',
        venueId,
        startsAt: new Date(at(wed(1), '17:30')),
        endsAt: new Date(at(wed(1), '19:00')),
        capacity: 8,
      })
      // отменённое и стык по границе не конфликтуют
      const cancelled = await eventService.create(owner(), orgId, {
        title: 'Отменено',
        venueId,
        startsAt: new Date(at(wed(2))),
        endsAt: new Date(at(wed(2), '18:00')),
        capacity: 8,
      })
      await eventService.cancel(owner(), cancelled.id)
      await eventService.create(owner(), orgId, {
        title: 'Стык',
        venueId,
        startsAt: new Date(at(wed(0), '18:00')),
        endsAt: new Date(at(wed(0), '19:00')),
        capacity: 8,
      })
      const before = await balance()
      const input = weekly(3, { template: template({ venueId }) })
      const preview = await seriesService.preview(owner(), orgId, input)
      expect(preview.dates.map((d) => [d.date, d.status, d.draftReason])).toEqual([
        [wed(0), 'published', null],
        [wed(1), 'draft', 'venue_conflict'],
        [wed(2), 'published', null],
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
        rule: { freq: 'weekly', weekdays: [1, 2], startDate: BASE, count: 2 },
        template: template({ venueId, startTime: '00:00', durationMinutes: 1440 }),
      })
      expect(preview.dates.map((d) => d.status)).toEqual(['published', 'published'])
    })

    it('planner: a date overlapping an earlier date of the same series becomes a draft', () => {
      const h = (n: number) => new Date(Date.UTC(2030, 0, 7, n))
      const plan = planSeriesDates(
        [
          { date: '2030-01-07', startsAt: h(10), endsAt: h(14) },
          { date: '2030-01-08', startsAt: h(12), endsAt: h(16) },
          { date: '2030-01-09', startsAt: h(20), endsAt: h(22) },
          { date: '2030-01-10', startsAt: h(23), endsAt: h(24) },
        ],
        { venueId: 1, busy: [{ startsAt: h(21), endsAt: h(23) }] },
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
      const { monday, sunday } = nextBerlinSpringShift()
      const result = await seriesService.create(owner(), orgId, {
        rule: { freq: 'weekly', weekdays: [3], startDate: monday, count: 2 },
        template: template(),
        idempotencyKey: key(),
      })
      const rows = await seriesEvents(result.series.id)
      // среда до перехода — UTC+1, после — UTC+2
      expect(rows.map((e) => e.startsAt.toISOString())).toEqual([
        at(addDays(monday, 2), '18:00'),
        at(addDays(sunday, 3), '17:00'),
      ])
      expect(result.series.timezone).toBe('Europe/Berlin')
    })

    it('366 dates fit the limit; more is series.too_many_dates', async () => {
      const daily = { freq: 'weekly' as const, weekdays: [1, 2, 3, 4, 5, 6, 7], startDate: BASE }
      const ok = await seriesService.create(owner(), orgId, {
        rule: { ...daily, count: 366 },
        template: template(),
        idempotencyKey: key(),
      })
      expect(ok.total).toBe(366)
      const tooMany = { rule: { ...daily, until: addDays(BASE, 366) }, template: template() }
      expect(await codeOfCall(seriesService.preview(owner(), orgId, tooMany))).toBe(
        'series.too_many_dates',
      )
      expect(
        await codeOfCall(
          seriesService.create(owner(), orgId, { ...tooMany, idempotencyKey: key() }),
        ),
      ).toBe('series.too_many_dates')
    })

    it.each([
      [
        'series.invalid_rule',
        { rule: { freq: 'weekly', weekdays: [], startDate: BASE, count: 3 }, template: template() },
      ],
      [
        'event.starts_in_past',
        { rule: { freq: 'once', weekdays: [], startDate: '2020-01-01' }, template: template() },
      ],
    ])('rejects %s', async (code, input) => {
      expect(
        await codeOfCall(
          seriesService.create(owner(), orgId, { ...input, idempotencyKey: key() } as never),
        ),
      ).toBe(code)
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
      const input = weekly(4)
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
      const input = weekly(3)
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
            rule: { freq: 'weekly', weekdays: [i + 1], startDate: BASE, count: 4 },
            template: template(),
            idempotencyKey: key(),
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
      expect(view.events.map((e) => e.seriesDate)).toEqual([wed(0), wed(1)])
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
        { scope: 'following', from: wed(1) },
        { startTime: '20:30', durationMinutes: 90, capacity: 14, title: 'Новое время' },
      )
      expect(result.updated).toBe(2)
      const after = await seriesEvents(series.id)
      expect(after[0]).toMatchObject({ title: 'Тренировка по средам', capacity: 12 })
      expect(after[0]!.startsAt.toISOString()).toBe(at(wed(0)))
      expect(after[1]).toMatchObject({ title: 'Новое время', capacity: 14 })
      expect(after[1]!.startsAt.toISOString()).toBe(at(wed(1), '17:30'))
      expect(after[1]!.endsAt.toISOString()).toBe(at(wed(1), '19:00'))
      expect(after[2]!.startsAt.toISOString()).toBe(at(wed(2), '17:30'))
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
        { scope: 'single', from: wed(1) },
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
            { scope: 'single', from: wed(10) },
            { capacity: 20 },
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
            { scope: 'following', from: wed(0) },
            { capacity: 1 },
          ),
        ),
      ).toBe('event.capacity_below_taken')
      expect((await seriesEvents(series.id)).map((e) => e.capacity)).toEqual([12, 12, 2])
    })

    it('following validates the new template even when no dates are left to change', async () => {
      const { series } = await seriesService.create(owner(), orgId, weekly(2))
      const [other] = await db
        .insert(users)
        .values({ email: `other-${Math.random()}@t.by` })
        .returning()
      const otherOrg = await organizationService.create({ userId: other!.id }, { name: 'Other' })
      const foreignVenue = await venueService.create(
        { userId: other!.id },
        { organizationId: otherOrg.id, name: 'Чужой зал' },
      )
      const [original] = await db.select().from(eventSeries).where(eq(eventSeries.id, series.id))
      const late = { scope: 'following' as const, from: wed(20) }
      expect(
        await codeOfCall(
          seriesService.update(owner(), orgId, series.id, late, { venueId: foreignVenue.id }),
        ),
      ).toBe('event.venue_not_in_org')
      // режим split без цели не сохраняется в шаблон
      expect(
        await codeOfCall(
          seriesService.update(owner(), orgId, series.id, late, { priceMode: 'split', price: 0 }),
        ),
      ).toBe('ZodError')
      const [stored] = await db.select().from(eventSeries).where(eq(eventSeries.id, series.id))
      expect(stored!.template).toEqual(original!.template)
    })

    it('following stores «no venue» as an absent key, not null', async () => {
      const { series } = await seriesService.create(
        owner(),
        orgId,
        weekly(2, { template: template({ venueId }) }),
      )
      const result = await seriesService.update(
        owner(),
        orgId,
        series.id,
        { scope: 'following', from: wed(0) },
        { venueId: null, description: null },
      )
      expect(result.updated).toBe(2)
      const [stored] = await db.select().from(eventSeries).where(eq(eventSeries.id, series.id))
      expect(stored!.template).not.toHaveProperty('venueId')
      expect(stored!.template).not.toHaveProperty('description')
      expect((await seriesEvents(series.id)).map((e) => e.venueId)).toEqual([null, null])
    })

    it('PATCH of a series event may change its time but not its calendar day', async () => {
      const { series } = await seriesService.create(owner(), orgId, weekly(2))
      const [first] = await seriesEvents(series.id)
      const moved = await eventService.update(owner(), first!.id, {
        startsAt: new Date(at(wed(0), '18:00')),
        endsAt: new Date(at(wed(0), '20:00')),
      })
      expect(moved.startsAt.toISOString()).toBe(at(wed(0), '18:00'))
      expect(
        await codeOfCall(
          eventService.update(owner(), first!.id, {
            startsAt: new Date(at(addDays(wed(0), 1))),
            endsAt: new Date(at(addDays(wed(0), 1), '18:00')),
          }),
        ),
      ).toBe('event.series_date_locked')
      // 01:00 по Минску следующего дня — тоже другой календарный день, хотя в UTC тот же
      expect(
        await codeOfCall(
          eventService.update(owner(), first!.id, {
            startsAt: new Date(at(wed(0), '22:00')),
            endsAt: new Date(at(wed(0), '23:00')),
          }),
        ),
      ).toBe('event.series_date_locked')
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
      const result = await seriesService.cancel(owner(), orgId, series.id, { from: wed(1) })
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

    it('never touches dates that already started; from before today is rejected', async () => {
      await setBalance(10)
      const { series } = await seriesService.create(owner(), orgId, weekly(3))
      const rows = await seriesEvents(series.id)
      // 1-я дата «сегодня» и уже идёт (сыграна или идёт сейчас)
      await db
        .update(events)
        .set({
          seriesDate: today(),
          startsAt: new Date(Date.now() - 3600_000),
          endsAt: new Date(Date.now() + 3600_000),
        })
        .where(eq(events.id, rows[0]!.id))
      expect(
        await codeOfCall(
          seriesService.cancel(owner(), orgId, series.id, { from: addDays(today(), -1) }),
        ),
      ).toBe('series.from_in_past')
      const result = await seriesService.cancel(owner(), orgId, series.id, { from: today() })
      expect(result).toMatchObject({ cancelled: 2, balanceRefunds: 2 })
      const [played] = await db.select().from(events).where(eq(events.id, rows[0]!.id))
      expect(played!.status).toBe('published')
      expect((await entries('refund')).map((r) => r.eventId)).not.toContain(rows[0]!.id)
      // отменять больше нечего — серия завершена тем же предикатом
      const [stored] = await db.select().from(eventSeries).where(eq(eventSeries.id, series.id))
      expect(stored!.status).toBe('ended')
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
        { from: wed(0) },
      )
      expect(notifications).toHaveLength(1)
      expect(notifications[0]).toMatchObject({ userId: playerId, type: 'event_cancelled' })
    })

    it('is idempotent and ends the series when nothing is left', async () => {
      await setBalance(10)
      const { series } = await seriesService.create(owner(), orgId, weekly(3))
      const first = await seriesService.cancel(owner(), orgId, series.id, { from: wed(0) })
      expect(first).toMatchObject({ cancelled: 3, balanceRefunds: 3 })
      const again = await seriesService.cancel(owner(), orgId, series.id, { from: wed(0) })
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
          seriesService.cancel(owner(), orgId, series.id, { from: wed(0) }),
        ),
      )
      expect(results.reduce((n, r) => n + r.cancelled, 0)).toBe(4)
      expect(await entries('refund')).toHaveLength(4)
      expect(await balance()).toBe(10)
      expect((await drift()).length).toBe(0)
    })

    // Гонки упорядочены реальным advisory-lock 3-й даты (behindEventLock): операции ждут в очереди
    // в заданном порядке и запускаются вместе.
    async function threeDates() {
      await setBalance(10)
      const { series } = await seriesService.create(owner(), orgId, weekly(3))
      return { series, rows: await seriesEvents(series.id) }
    }
    const refundsFor = async (ids: number[]) =>
      (await entries('refund')).filter((r) => ids.includes(r.eventId!))

    it('series cancel queued before a booking on a later date: the booking is refused', async () => {
      const { series, rows } = await threeDates()
      const [cancel, book] = await behindEventLock(rows[2]!.id, [
        () => seriesService.cancel(owner(), orgId, series.id, { from: wed(0) }),
        () => bookingService.book({ userId: playerId }, orgId, rows[2]!.id, { method: 'cash' }),
      ])
      expect(codeOf(cancel!)).toBe('ok')
      expect(codeOf(book!)).toBe('booking.event_not_bookable')
      expect(await refundsFor(rows.map((r) => r.id))).toHaveLength(3)
      expect((await drift()).length).toBe(0)
    })

    it('booking queued before a series cancel: the booking is cancelled and blocks the refund', async () => {
      const { series, rows } = await threeDates()
      const [book, cancel] = await behindEventLock(rows[2]!.id, [
        () => bookingService.book({ userId: playerId }, orgId, rows[2]!.id, { method: 'cash' }),
        () => seriesService.cancel(owner(), orgId, series.id, { from: wed(0) }),
      ])
      expect(codeOf(book!)).toBe('ok')
      expect(codeOf(cancel!)).toBe('ok')
      const active = await db
        .select()
        .from(bookings)
        .where(and(eq(bookings.eventId, rows[2]!.id), sql`${bookings.status} <> 'cancelled'`))
      expect(active).toHaveLength(0)
      const refunds = await refundsFor(rows.map((r) => r.id))
      expect(refunds.map((r) => r.eventId).sort()).toEqual([rows[0]!.id, rows[1]!.id].sort())
      expect((await drift()).length).toBe(0)
    })

    it.each([
      ['single cancel first', true],
      ['series cancel first', false],
    ])(
      'series cancel vs a concurrent single-event cancel (%s): no deadlock, one refund per date',
      async (_label, singleFirst) => {
        const { series, rows } = await threeDates()
        const single = () => eventService.cancel(owner(), rows[2]!.id)
        const whole = () => seriesService.cancel(owner(), orgId, series.id, { from: wed(0) })
        const results = await behindEventLock(
          rows[2]!.id,
          singleFirst ? [single, whole] : [whole, single],
        )
        expect(results.map(codeOf)).toEqual(['ok', 'ok'])
        expect((await seriesEvents(series.id)).every((e) => e.status === 'cancelled')).toBe(true)
        expect(await refundsFor(rows.map((r) => r.id))).toHaveLength(3)
        expect(await balance()).toBe(10)
        expect((await drift()).length).toBe(0)
      },
    )

    it.each([
      ['publish first', true],
      ['series cancel first', false],
    ])(
      'series cancel vs publishing a draft date (%s) keeps the balance exact',
      async (_l, publishFirst) => {
        await setBalance(1)
        const { series } = await seriesService.create(owner(), orgId, weekly(3)) // 1 опубликована
        const rows = await seriesEvents(series.id)
        await setBalance(5)
        const publish = () => eventService.update(owner(), rows[2]!.id, { status: 'published' })
        const whole = () => seriesService.cancel(owner(), orgId, series.id, { from: wed(0) })
        const results = await behindEventLock(
          rows[2]!.id,
          publishFirst ? [publish, whole] : [whole, publish],
        )
        const [first, second] = results.map(codeOf)
        expect(first).toBe('ok')
        expect(second).toBe(publishFirst ? 'ok' : 'event.not_editable')
        expect((await seriesEvents(series.id)).every((e) => e.status === 'cancelled')).toBe(true)
        // опубликованное без записей возвращается: 5 − (списание публикации) + возвраты
        expect(await balance()).toBe(6)
        expect((await drift()).length).toBe(0)
      },
    )
  })
})
