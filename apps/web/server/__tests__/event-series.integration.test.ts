import { memberService, organizationService } from '@volley-time/core'
import { closeDb, db, eq, events, eventSeries, organizations, users } from '@volley-time/db'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { createTestApi } from './harness'

type Body = { data?: { code?: string }; [key: string]: unknown }

/** Task 20.2.2: серии событий по HTTP — контракт для 20.5.5, 21.1.2, 21.1.7; коды ошибок. */
describe('event series API (HTTP integration)', () => {
  let request: Awaited<ReturnType<typeof createTestApi>>
  let ownerId: number
  let organizerId: number
  let playerId: number
  let orgId: number
  const previousFlag = process.env.EVENT_BALANCE_ENFORCED
  const base = () => `/api/organizations/${orgId}/series`
  const body = (extra: Record<string, unknown> = {}) => ({
    rule: { freq: 'weekly', weekdays: [3], startDate: '2027-01-04', count: 7 },
    template: { title: 'Среда', startTime: '19:00', durationMinutes: 120, capacity: 12 },
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
    const preview = await request('POST', `${base()}/preview`, { user: organizerId, body: body() })
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

    const created = await request('POST', base(), {
      user: organizerId,
      body: body({ idempotencyKey: 'wizard-step-2-0001' }),
    })
    expect(created.status, created.text).toBe(200)
    const result = created.body as {
      series: { id: number }
      published: number
      drafts: number
      balanceAfter: number
      replayed: boolean
    }
    expect(result).toMatchObject({ published: 5, drafts: 2, balanceAfter: 0, replayed: false })

    const retry = await request('POST', base(), {
      user: organizerId,
      body: body({ idempotencyKey: 'wizard-step-2-0001' }),
    })
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

  it('patch following and cancel following over HTTP', async () => {
    const created = await request('POST', base(), { user: ownerId, body: body() })
    const id = (created.body as { series: { id: number } }).series.id
    const patched = await request('PATCH', `${base()}/${id}?scope=following&from=2027-01-13`, {
      user: organizerId,
      body: { capacity: 16 },
    })
    expect(patched.status, patched.text).toBe(200)
    expect((patched.body as { updated: number }).updated).toBe(6)

    const cancelled = await request('POST', `${base()}/${id}/cancel`, {
      user: organizerId,
      body: { from: '2027-02-03' },
    })
    expect(cancelled.status, cancelled.text).toBe(200)
    expect(cancelled.body).toMatchObject({ cancelled: 3, balanceRefunds: 1 })
    const rows = await db.select().from(events).where(eq(events.seriesId, id))
    expect(rows.filter((e) => e.status === 'cancelled')).toHaveLength(3)
  })

  it.each([
    [
      'series.invalid_rule',
      422,
      { rule: { freq: 'weekly', weekdays: [], startDate: '2027-01-04', count: 2 } },
    ],
    [
      'series.too_many_dates',
      422,
      {
        rule: {
          freq: 'weekly',
          weekdays: [1, 2, 3, 4, 5, 6, 7],
          startDate: '2027-01-01',
          until: '2028-06-01',
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
      body: body({ idempotencyKey: 'conflict-0001', exceptions: ['2027-01-13'] }),
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
