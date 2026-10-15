import { memberService, organizationService } from '@volley-time/core'
import { closeDb, db, eq, events, eventSeries, organizations, users } from '@volley-time/db'
import { dateToZonedInput } from '@volley-time/shared'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { createTestApi } from './harness'

type Body = { data?: { code?: string }; [key: string]: unknown }

const DAY = 86_400_000
const addDays = (date: string, n: number) =>
  new Date(Date.parse(`${date}T00:00:00Z`) + n * DAY).toISOString().slice(0, 10)
const todayMinsk = () => dateToZonedInput(new Date(), 'Europe/Minsk').slice(0, 10)
/** Понедельник через 3+ недели: даты не «протухают» (ревью PR #145). */
function futureMonday(): string {
  const start = addDays(new Date().toISOString().slice(0, 10), 21)
  const weekday = (new Date(`${start}T00:00:00Z`).getUTCDay() + 6) % 7
  return addDays(start, (7 - weekday) % 7)
}
const BASE = futureMonday()
const wed = (i: number) => addDays(BASE, 2 + 7 * i)

/** Task 20.2.2: серии событий по HTTP — контракт для 20.5.5, 21.1.2, 21.1.7; коды ошибок. */
describe('event series API (HTTP integration)', () => {
  let request: Awaited<ReturnType<typeof createTestApi>>
  let ownerId: number
  let organizerId: number
  let playerId: number
  let orgId: number
  let seq = 0
  const previousFlag = process.env.EVENT_BALANCE_ENFORCED
  const base = () => `/api/organizations/${orgId}/series`
  const body = (extra: Record<string, unknown> = {}) => ({
    rule: { freq: 'weekly', weekdays: [3], startDate: BASE, count: 7 },
    template: { title: 'Среда', startTime: '19:00', durationMinutes: 120, capacity: 12 },
    idempotencyKey: `http-key-${Date.now()}-${seq++}`,
    ...extra,
  })

  async function newUser(tag: string) {
    const [u] = await db
      .insert(users)
      .values({ email: `ser-${tag}-${Math.random()}@t.by`, name: `Name ${tag}` })
      .returning()
    return u!.id
  }

  beforeAll(async () => {
    request = await createTestApi()
  })

  beforeEach(async () => {
    process.env.EVENT_BALANCE_ENFORCED = 'true'
    await db.delete(organizations)
    await db.delete(users)
    ownerId = await newUser('owner')
    organizerId = await newUser('organizer')
    playerId = await newUser('player')
    // новая группа — demo-квота 5 событий
    orgId = (await organizationService.create({ userId: ownerId }, { name: 'Series HTTP' })).id
    await memberService.add(
      { userId: ownerId },
      { organizationId: orgId, userId: organizerId, role: 'organizer' },
    )
    await memberService.add({ userId: ownerId }, { organizationId: orgId, userId: playerId })
  })

  afterEach(() => {
    if (previousFlag === undefined) delete process.env.EVENT_BALANCE_ENFORCED
    else process.env.EVENT_BALANCE_ENFORCED = previousFlag
  })

  afterAll(async () => {
    await db.delete(organizations)
    await db.delete(users)
    await closeDb()
  })

  it('preview then create: counts and balance after match (21.1.7 contract)', async () => {
    const input = body({ idempotencyKey: 'wizard-step-2-0001' })
    const preview = await request('POST', `${base()}/preview`, { user: organizerId, body: input })
    expect(preview.status, preview.text).toBe(200)
    expect(preview.body).toMatchObject({
      total: 7,
      published: 5,
      drafts: 2,
      balanceBefore: 5,
      balanceAfter: 0,
      timezone: 'Europe/Minsk',
    })
    expect(await db.select().from(eventSeries)).toHaveLength(0)

    const created = await request('POST', base(), { user: organizerId, body: input })
    expect(created.status, created.text).toBe(200)
    const result = created.body as {
      series: { id: number }
      published: number
      drafts: number
      balanceAfter: number
      replayed: boolean
    }
    expect(result).toMatchObject({ published: 5, drafts: 2, balanceAfter: 0, replayed: false })

    const retry = await request('POST', base(), { user: organizerId, body: input })
    expect(retry.status).toBe(200)
    expect(retry.body).toMatchObject({ series: { id: result.series.id }, replayed: true })

    const view = await request('GET', `${base()}/${result.series.id}`, { user: ownerId })
    expect(view.status).toBe(200)
    expect((view.body as { events: unknown[] }).events).toHaveLength(7)

    // игрок не видит черновики серии в списке событий группы
    const list = await request('GET', `/api/organizations/${orgId}/events?filter=all`, {
      user: playerId,
    })
    expect((list.body as { events: { status: string }[] }).events.map((e) => e.status)).toEqual(
      Array(5).fill('published'),
    )
  })

  it('POST /series without an idempotency key → 422; preview accepts it', async () => {
    const input: Record<string, unknown> = { ...body() }
    delete input.idempotencyKey
    const created = await request('POST', base(), { user: ownerId, body: input })
    expect(created.status).toBe(422)
    expect((created.body as Body).data?.code).toBe('validation_failed')
    const preview = await request('POST', `${base()}/preview`, { user: ownerId, body: input })
    expect(preview.status).toBe(200)
  })

  it('patch following and cancel following over HTTP', async () => {
    const created = await request('POST', base(), { user: ownerId, body: body() })
    const id = (created.body as { series: { id: number } }).series.id
    const patched = await request('PATCH', `${base()}/${id}?scope=following&from=${wed(1)}`, {
      user: organizerId,
      body: { capacity: 16 },
    })
    expect(patched.status, patched.text).toBe(200)
    expect((patched.body as { updated: number }).updated).toBe(6)

    const cancelled = await request('POST', `${base()}/${id}/cancel`, {
      user: organizerId,
      body: { from: wed(4) },
    })
    expect(cancelled.status, cancelled.text).toBe(200)
    expect(cancelled.body).toMatchObject({ cancelled: 3, balanceRefunds: 1 })
    const rows = await db.select().from(events).where(eq(events.seriesId, id))
    expect(rows.filter((e) => e.status === 'cancelled')).toHaveLength(3)

    const past = await request('POST', `${base()}/${id}/cancel`, {
      user: organizerId,
      body: { from: addDays(todayMinsk(), -1) },
    })
    expect(past.status).toBe(422)
    expect((past.body as Body).data?.code).toBe('series.from_in_past')

    // календарный день события серии меняется только правкой серии
    const first = rows.find((e) => e.seriesDate === wed(0))!
    const moved = await request('PATCH', `/api/organizations/${orgId}/events/${first.id}`, {
      user: organizerId,
      body: {
        startsAt: `${wed(1)}T10:00:00.000Z`,
        endsAt: `${wed(1)}T12:00:00.000Z`,
      },
    })
    expect(moved.status).toBe(409)
    expect((moved.body as Body).data?.code).toBe('event.series_date_locked')
  })

  it.each([
    [
      'series.invalid_rule',
      422,
      { rule: { freq: 'weekly', weekdays: [], startDate: BASE, count: 2 } },
    ],
    [
      'series.too_many_dates',
      422,
      {
        rule: {
          freq: 'weekly',
          weekdays: [1, 2, 3, 4, 5, 6, 7],
          startDate: BASE,
          until: addDays(BASE, 400),
        },
      },
    ],
    [
      'event.starts_in_past',
      422,
      { rule: { freq: 'once', weekdays: [], startDate: '2020-01-01' } },
    ],
    ['validation_failed', 422, { unknown: true }],
  ])('%s → %i', async (code, status, extra) => {
    for (const path of [`${base()}/preview`, base()]) {
      const res = await request('POST', path, { user: ownerId, body: body(extra) })
      expect(res.status, res.text).toBe(status)
      expect((res.body as Body).data?.code).toBe(code)
    }
  })

  it('idempotency conflict → 409; unknown series → 404 series.not_found', async () => {
    await request('POST', base(), {
      user: ownerId,
      body: body({ idempotencyKey: 'conflict-0001' }),
    })
    const conflict = await request('POST', base(), {
      user: ownerId,
      body: body({ idempotencyKey: 'conflict-0001', exceptions: [wed(1)] }),
    })
    expect(conflict.status).toBe(409)
    expect((conflict.body as Body).data?.code).toBe('series.idempotency_conflict')
    const missing = await request('GET', `${base()}/999999`, { user: ownerId })
    expect(missing.status).toBe(404)
    expect((missing.body as Body).data?.code).toBe('series.not_found')
    const bad = await request('GET', `${base()}/abc`, { user: ownerId })
    expect(bad.status).toBe(404)
  })
})
