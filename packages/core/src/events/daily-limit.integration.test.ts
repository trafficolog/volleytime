import {
  appendEventBalanceEntry,
  and,
  closeDb,
  db,
  eq,
  eventBalanceEntries,
  events,
  organizationEventBalances,
  organizations,
  platformSettings,
  users,
} from '@volley-time/db'
import { resetPlatformSettings } from '@volley-time/db/test-utils'
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest'

import { addDays, futureMonday } from '../__tests__/series-dates'
import { organizationService } from '../organizations/service'
import { invalidatePlatformSettingsCache } from '../platform/settings'
import { seriesService } from '../series/service'

import { eventService } from './service'

/**
 * Task 22.3.1 (ADR-22-3-1, D-20): дневной лимит опубликованных событий группы. Даты — далёкое
 * будущее с фиксированными моментами UTC, чтобы тесты не зависели от текущей даты и пояса runner.
 */
const previousFlag = process.env.EVENT_BALANCE_ENFORCED
let ownerId: number
let orgId: number
const owner = () => ({ userId: ownerId })

async function setLimit(limit: number | null) {
  await db
    .insert(platformSettings)
    .values({ key: 'events.maxPublishedPerDay', value: limit })
    .onConflictDoUpdate({ target: platformSettings.key, set: { value: limit } })
  invalidatePlatformSettingsCache()
}

const at = (iso: string, hours = 2) => ({
  startsAt: new Date(iso),
  endsAt: new Date(new Date(iso).getTime() + hours * 3600_000),
})
const input = (title: string, iso: string, extra: Record<string, unknown> = {}) => ({
  title: `Игра ${title}`,
  ...at(iso),
  capacity: 10,
  price: 0,
  ...extra,
})

const codeOf = (r: PromiseSettledResult<unknown>) => {
  if (r.status === 'fulfilled') return 'ok'
  const reason = r.reason as { code?: string; name?: string }
  return reason.code ?? reason.name ?? String(r.reason)
}
const codeOfCall = async (p: Promise<unknown>) => codeOf((await Promise.allSettled([p]))[0]!)

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
const spendRows = async () =>
  (
    await db.select().from(eventBalanceEntries).where(eq(eventBalanceEntries.organizationId, orgId))
  ).filter((e) => e.reason === 'spend')

async function newOrg(extra: Record<string, unknown> = {}) {
  return (await organizationService.create(owner(), { name: `DL ${Math.random()}`, ...extra })).id
}

describe('daily limit of published events (integration, 22.3.1)', { timeout: 90_000 }, () => {
  beforeEach(async () => {
    process.env.EVENT_BALANCE_ENFORCED = 'true'
    await db.delete(organizations)
    await db.delete(users)
    await resetPlatformSettings()
    invalidatePlatformSettingsCache()
    const [u] = await db
      .insert(users)
      .values({ email: `dl-${Math.random()}@t.by`, name: 'Owner' })
      .returning()
    ownerId = u!.id
    orgId = await newOrg()
    await setBalance(100)
  })

  afterEach(() => {
    if (previousFlag === undefined) delete process.env.EVENT_BALANCE_ENFORCED
    else process.env.EVENT_BALANCE_ENFORCED = previousFlag
  })

  afterAll(async () => {
    await resetPlatformSettings()
    await db.delete(organizations)
    await db.delete(users)
    await closeDb()
  })

  it('without a limit nothing is refused (behaviour before 22.3.1)', async () => {
    for (let i = 0; i < 4; i++)
      await eventService.create(owner(), orgId, input(`E${i}`, `2040-06-10T${10 + i}:00:00Z`))
    expect(await db.select().from(events).where(eq(events.organizationId, orgId))).toHaveLength(4)
  })

  it('refuses a publication over the limit with date and limit, and allows other days', async () => {
    await setLimit(2)
    await eventService.create(owner(), orgId, input('A', '2040-06-10T08:00:00Z'))
    await eventService.create(owner(), orgId, input('B', '2040-06-10T10:00:00Z'))
    const err = (await eventService
      .create(owner(), orgId, input('C', '2040-06-10T12:00:00Z'))
      .catch((e: unknown) => e)) as { code: string; details: unknown; message: string }
    expect(err.code).toBe('event.daily_limit_reached')
    expect(err.details).toEqual({ date: '2040-06-10', limit: 2 })
    expect(err.message).toContain('лимит платформы')
    await eventService.create(owner(), orgId, input('D', '2040-06-11T10:00:00Z'))
    // отказ откатил всё: события C нет, баланс не списан
    expect(await db.select().from(events).where(eq(events.organizationId, orgId))).toHaveLength(3)
    expect(await spendRows()).toHaveLength(3)
  })

  it('counts published, closed and finished; does not count draft and cancelled', async () => {
    await setLimit(1)
    const day = '2040-06-10'
    await eventService.create(
      owner(),
      orgId,
      input('draft', `${day}T08:00:00Z`, { status: 'draft' }),
    )
    const cancelled = await eventService.create(owner(), orgId, input('x', `${day}T09:00:00Z`))
    await eventService.cancel(owner(), cancelled.id)
    // черновик и отменённое не мешают одной публикации
    const live = await eventService.create(owner(), orgId, input('live', `${day}T10:00:00Z`))
    expect(
      await codeOfCall(eventService.create(owner(), orgId, input('n', `${day}T11:00:00Z`))),
    ).toBe('event.daily_limit_reached')
    for (const status of ['closed', 'finished'] as const) {
      await db.update(events).set({ status }).where(eq(events.id, live.id))
      expect(
        await codeOfCall(eventService.create(owner(), orgId, input('n', `${day}T11:00:00Z`))),
        status,
      ).toBe('event.daily_limit_reached')
    }
    await db.update(events).set({ status: 'cancelled' }).where(eq(events.id, live.id))
    expect(
      await codeOfCall(eventService.create(owner(), orgId, input('ok', `${day}T11:00:00Z`))),
    ).toBe('ok')
  })

  it('a day is the group time zone day, not UTC and not Minsk', async () => {
    await setLimit(1)
    const nz = await newOrg()
    await db
      .update(organizations)
      .set({ defaultTimezone: 'Pacific/Auckland' }) // UTC+12 зимой
      .where(eq(organizations.id, nz))
    await setBalance(0)
    await db
      .insert(organizationEventBalances)
      .values({ organizationId: nz, balance: 50 })
      .onConflictDoUpdate({
        target: organizationEventBalances.organizationId,
        set: { balance: 50 },
      })
    // 23:30 и 00:30 по Окленду — разные дни, хотя оба в одни сутки UTC
    await eventService.create(owner(), nz, input('late', '2040-06-10T11:30:00Z'))
    await eventService.create(owner(), nz, input('after midnight', '2040-06-10T12:30:00Z'))
    // 00:10 и 23:50 следующего дня по Окленду — один день
    expect(
      await codeOfCall(eventService.create(owner(), nz, input('same day', '2040-06-11T11:50:00Z'))),
    ).toBe('event.daily_limit_reached')
    // в Минске те же два момента дали бы одну дату и отказ
    await setBalance(100)
    await eventService.create(owner(), orgId, input('minsk 1', '2040-06-10T11:30:00Z'))
    expect(
      await codeOfCall(
        eventService.create(owner(), orgId, input('minsk 2', '2040-06-10T12:30:00Z')),
      ),
    ).toBe('event.daily_limit_reached')
  })

  it('other groups are not affected by the day of this group', async () => {
    await setLimit(1)
    const other = await newOrg()
    await eventService.create(owner(), orgId, input('mine', '2040-06-10T10:00:00Z'))
    await eventService.create(owner(), other, input('theirs', '2040-06-10T10:00:00Z'))
  })

  it('draft → published is checked; moving startsAt to another full day is refused', async () => {
    await setLimit(1)
    await eventService.create(owner(), orgId, input('A', '2040-06-10T10:00:00Z'))
    const draft = await eventService.create(
      owner(),
      orgId,
      input('draft', '2040-06-10T12:00:00Z', { status: 'draft' }),
    )
    expect(await codeOfCall(eventService.update(owner(), draft.id, { status: 'published' }))).toBe(
      'event.daily_limit_reached',
    )
    expect(await balance()).toBe(99)

    const b = await eventService.create(owner(), orgId, input('B', '2040-06-11T10:00:00Z'))
    // перенос на занятый день — отказ; на другое время того же дня — можно
    expect(await codeOfCall(eventService.update(owner(), b.id, at('2040-06-10T15:00:00Z')))).toBe(
      'event.daily_limit_reached',
    )
    expect(await codeOfCall(eventService.update(owner(), b.id, at('2040-06-11T15:00:00Z')))).toBe(
      'ok',
    )
    // перенос на свободный день — можно
    expect(await codeOfCall(eventService.update(owner(), b.id, at('2040-06-12T15:00:00Z')))).toBe(
      'ok',
    )
  })

  it('reopening closed → published in the same day is not rechecked', async () => {
    const a = await eventService.create(owner(), orgId, input('A', '2040-06-10T10:00:00Z'))
    await eventService.create(owner(), orgId, input('B', '2040-06-10T12:00:00Z'))
    await eventService.update(owner(), a.id, { status: 'closed' })
    await setLimit(1) // день уже перегружен, но переоткрытие число событий дня не меняет
    expect(await codeOfCall(eventService.update(owner(), a.id, { status: 'published' }))).toBe('ok')
  })

  it('the unlimited balance of the group does not lift the daily limit', async () => {
    await setLimit(1)
    await db
      .update(organizations)
      .set({ eventBalanceUnlimitedUntil: new Date(Date.now() + 5 * 86_400_000) })
      .where(eq(organizations.id, orgId))
    await eventService.create(owner(), orgId, input('A', '2040-06-10T10:00:00Z'))
    expect(
      await codeOfCall(eventService.create(owner(), orgId, input('B', '2040-06-10T12:00:00Z'))),
    ).toBe('event.daily_limit_reached')
    expect(await spendRows()).toHaveLength(0)
  })

  describe('concurrency (real database)', () => {
    it.each([['true'], ['false']])(
      'limit 1, EVENT_BALANCE_ENFORCED=%s: two parallel publications of different events — exactly one succeeds',
      async (flag) => {
        process.env.EVENT_BALANCE_ENFORCED = flag
        await setLimit(1)
        for (let round = 0; round < 5; round++) {
          const day = `2040-07-${String(10 + round).padStart(2, '0')}`
          const results = await Promise.allSettled([
            eventService.create(owner(), orgId, input(`P${round}a`, `${day}T08:00:00Z`)),
            eventService.create(owner(), orgId, input(`P${round}b`, `${day}T12:00:00Z`)),
          ])
          const codes = results.map(codeOf).sort()
          expect(codes, day).toEqual(['event.daily_limit_reached', 'ok'])
        }
      },
    )

    it.each([['true'], ['false']])(
      'EVENT_BALANCE_ENFORCED=%s: two drafts published in parallel — exactly one succeeds',
      async (flag) => {
        process.env.EVENT_BALANCE_ENFORCED = flag
        await setLimit(1)
        const [d1, d2] = await Promise.all(
          ['a', 'b'].map((t, i) =>
            eventService.create(
              owner(),
              orgId,
              input(t, `2040-08-10T${String(8 + i * 4).padStart(2, '0')}:00:00Z`, {
                status: 'draft',
              }),
            ),
          ),
        )
        const results = await Promise.allSettled([
          eventService.update(owner(), d1!.id, { status: 'published' }),
          eventService.update(owner(), d2!.id, { status: 'published' }),
        ])
        expect(results.map(codeOf).sort()).toEqual(['event.daily_limit_reached', 'ok'])
      },
    )

    it('a creation and a draft publication racing for one slot: exactly one succeeds', async () => {
      await setLimit(1)
      const draft = await eventService.create(
        owner(),
        orgId,
        input('draft', '2040-09-10T08:00:00Z', { status: 'draft' }),
      )
      const results = await Promise.allSettled([
        eventService.create(owner(), orgId, input('new', '2040-09-10T12:00:00Z')),
        eventService.update(owner(), draft.id, { status: 'published' }),
      ])
      expect(results.map(codeOf).sort()).toEqual(['event.daily_limit_reached', 'ok'])
    })

    it('a move to a day and a publication on that day race for one slot', async () => {
      await setLimit(1)
      const movable = await eventService.create(owner(), orgId, input('m', '2040-09-20T08:00:00Z'))
      const results = await Promise.allSettled([
        eventService.update(owner(), movable.id, at('2040-09-21T08:00:00Z')),
        eventService.create(owner(), orgId, input('new', '2040-09-21T12:00:00Z')),
      ])
      expect(results.map(codeOf).sort()).toEqual(['event.daily_limit_reached', 'ok'])
    })

    it('parallel publications with a balance of 1 and a limit: lock order does not deadlock', async () => {
      await setLimit(2)
      await setBalance(1)
      const results = await Promise.allSettled(
        Array.from({ length: 6 }, (_, i) =>
          eventService.create(owner(), orgId, input(`L${i}`, `2040-10-1${i}T10:00:00Z`)),
        ),
      )
      const codes = results.map(codeOf)
      expect(codes.filter((c) => c === 'ok')).toHaveLength(1)
      expect(codes.filter((c) => c === 'event_balance.insufficient')).toHaveLength(5)
      expect(await balance()).toBe(0)
    })
  })

  describe('series', () => {
    const BASE = futureMonday(3)
    const wed = (i: number) => addDays(BASE, 2 + 7 * i)
    const template = {
      title: 'Тренировка',
      startTime: '19:00',
      durationMinutes: 120,
      capacity: 12,
      price: 0,
    }
    let keySeq = 0
    const weekly = (count: number) => ({
      rule: { freq: 'weekly' as const, weekdays: [3], startDate: BASE, count },
      template,
      idempotencyKey: `dl-key-${Date.now()}-${keySeq++}`,
    })
    /** 13:00 по Минску той же даты. */
    const midday = (date: string) => `${date}T10:00:00.000Z`

    it('dates over the limit stay drafts with draftReason daily_limit and cost no balance', async () => {
      await setLimit(1)
      await eventService.create(owner(), orgId, input('занято', midday(wed(1))))
      const before = await balance()
      const preview = await seriesService.preview(owner(), orgId, weekly(3))
      expect(preview.dates.map((d) => [d.date, d.status, d.draftReason])).toEqual([
        [wed(0), 'published', null],
        [wed(1), 'draft', 'daily_limit'],
        [wed(2), 'published', null],
      ])
      expect(preview).toMatchObject({ published: 2, drafts: 1, dailyLimitDrafts: 1 })
      expect(preview.balanceAfter).toBe(before - 2)

      const created = await seriesService.create(owner(), orgId, weekly(3))
      expect(created.published).toBe(2)
      expect(created.drafts).toBe(1)
      expect(created.events.map((e) => e.status)).toEqual(['published', 'draft', 'published'])
      expect(await balance()).toBe(before - 2)
    })

    it('without a limit the series is unchanged; with unlimited balance every date is published free', async () => {
      const before = await balance()
      const plain = await seriesService.create(owner(), orgId, weekly(2))
      expect(plain.published).toBe(2)
      expect(await balance()).toBe(before - 2)

      await db
        .update(organizations)
        .set({ eventBalanceUnlimitedUntil: new Date(Date.now() + 5 * 86_400_000) })
        .where(eq(organizations.id, orgId))
      await setBalance(0)
      const preview = await seriesService.preview(owner(), orgId, {
        ...weekly(3),
        rule: { freq: 'weekly' as const, weekdays: [4], startDate: BASE, count: 3 },
      })
      expect(preview).toMatchObject({ unlimited: true, published: 3, drafts: 0, balanceAfter: 0 })
      const created = await seriesService.create(owner(), orgId, {
        ...weekly(3),
        rule: { freq: 'weekly' as const, weekdays: [4], startDate: BASE, count: 3 },
      })
      expect(created).toMatchObject({ published: 3, drafts: 0, balanceAfter: 0 })
      expect(await balance()).toBe(0)
      expect((await spendRows()).length).toBe(2) // только обычная серия до безлимита
    })

    it('a series and a single publication racing for the same day: exactly one event is published', async () => {
      await setLimit(1)
      for (let round = 0; round < 3; round++) {
        const base = addDays(BASE, 14 * (round + 1))
        const date = addDays(base, 2 - ((new Date(`${base}T00:00:00Z`).getUTCDay() + 6) % 7))
        const results = await Promise.allSettled([
          seriesService.create(owner(), orgId, {
            rule: {
              freq: 'weekly' as const,
              weekdays: [3],
              startDate: addDays(date, -2),
              count: 1,
            },
            template,
            idempotencyKey: `race-${Date.now()}-${keySeq++}`,
          }),
          eventService.create(owner(), orgId, input('single', `${date}T10:00:00.000Z`)),
        ])
        expect(
          results.every(
            (r) => r.status === 'fulfilled' || codeOf(r) === 'event.daily_limit_reached',
          ),
        ).toBe(true)
        const rows = await db
          .select()
          .from(events)
          .where(and(eq(events.organizationId, orgId), eq(events.status, 'published')))
        const sameDay = rows.filter((r) => r.startsAt.toISOString().slice(0, 10) === date)
        expect(sameDay, date).toHaveLength(1)
      }
    })
  })

  describe('starting balance setting', () => {
    it('the group gets the configured starting balance with a matching comment; default is 5', async () => {
      const def = await newOrg()
      const [defEntry] = await db
        .select()
        .from(eventBalanceEntries)
        .where(eq(eventBalanceEntries.organizationId, def))
      expect(defEntry).toMatchObject({ delta: 5, reason: 'demo_grant' })

      await db
        .insert(platformSettings)
        .values({ key: 'eventBalance.newOrganizationGrant', value: 12 })
      invalidatePlatformSettingsCache()
      const custom = await newOrg()
      const [entry] = await db
        .select()
        .from(eventBalanceEntries)
        .where(eq(eventBalanceEntries.organizationId, custom))
      expect(entry).toMatchObject({
        delta: 12,
        reason: 'demo_grant',
        comment: 'Стартовый баланс новой группы: 12 событий',
      })
      // уже созданные группы не трогаются
      const [old] = await db
        .select()
        .from(organizationEventBalances)
        .where(eq(organizationEventBalances.organizationId, def))
      expect(old!.balance).toBe(5)
    })
  })
})
