import { bookings, closeDb, db, events, organizations, users } from '@volley-time/db'
import { grantPlatformRole } from '@volley-time/db/test-utils'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'

import { ForbiddenError } from '../permissions/errors'

import { platformOverviewService } from './overview'

/**
 * Task 22.1.1: обзор платформы для root. Часы фиксированы (`now`), окна — скользящие сутки UTC,
 * поэтому результат не зависит от даты запуска и часового пояса раннера.
 */
describe('platformOverviewService (integration)', { timeout: 60_000 }, () => {
  const now = new Date('2026-11-18T12:00:00.000Z')
  const ago = (days: number, hours = 0) =>
    new Date(now.getTime() - days * 86_400_000 - hours * 3_600_000)
  let seq = 0
  let rootId: number
  let plainId: number
  let orgA: number
  let orgB: number
  let archivedOrg: number
  let deletedOrg: number

  const newUser = async (label: string, isRootAdmin = false) => {
    const [u] = await db
      .insert(users)
      .values({ email: `plat-${label}-${++seq}@t.by`, name: label })
      .returning()
    if (isRootAdmin) await grantPlatformRole(u!.id)
    return u!.id
  }
  const newOrg = async (
    name: string,
    extra: Partial<typeof organizations.$inferInsert> = {},
  ): Promise<number> =>
    (
      await db
        .insert(organizations)
        .values({
          name,
          slug: `plat-${name}-${++seq}`,
          ownerUserId: plainId,
          createdAt: ago(60),
          ...extra,
        })
        .returning()
    )[0]!.id
  const newEvent = async (
    org: number,
    startsAt: Date,
    status: (typeof events.$inferInsert)['status'] = 'published',
  ) =>
    (
      await db
        .insert(events)
        .values({
          organizationId: org,
          createdByUserId: plainId,
          title: 'E',
          startsAt,
          endsAt: new Date(startsAt.getTime() + 7_200_000),
          capacity: 10,
          status,
        })
        .returning()
    )[0]!.id
  const newBooking = async (
    org: number,
    eventId: number,
    createdAt: Date,
    status: (typeof bookings.$inferInsert)['status'] = 'confirmed',
  ) =>
    db.insert(bookings).values({
      eventId,
      userId: await newUser('b'),
      organizationId: org,
      status,
      method: 'free',
      createdAt,
    })
  const overview = () => platformOverviewService.getOverview({ userId: rootId }, now)

  beforeEach(async () => {
    await db.delete(organizations)
    await db.delete(users)
    rootId = await newUser('root', true)
    plainId = await newUser('plain')
    orgA = await newOrg('a')
    orgB = await newOrg('b')
    archivedOrg = await newOrg('archived', { status: 'archived' })
    deletedOrg = await newOrg('deleted', { deletedAt: ago(1), restoreUntil: ago(-29) })
  })
  afterAll(async () => {
    await db.delete(organizations)
    await db.delete(users)
    await closeDb()
  })

  it('refuses a non-root user even when called directly', async () => {
    await expect(
      platformOverviewService.getOverview({ userId: plainId }, now),
    ).rejects.toBeInstanceOf(ForbiddenError)
  })

  it('counts registered groups without archived and soft-deleted ones', async () => {
    const o = await overview()
    expect(o.northStar.registered).toBe(2)
    expect(o.generatedAt).toBe(now.toISOString())
  })

  it('north star counts groups with an event or a new booking in the last 7 days', async () => {
    const eventA = await newEvent(orgA, ago(1))
    const eventB = await newEvent(orgB, ago(10))
    // орг. B: запись создана на этой неделе при событии прошлой недели — тоже активность
    await newBooking(orgB, eventB, ago(2))
    // орг. A активна и на прошлой неделе
    await newEvent(orgA, ago(9))
    // архивная и удалённая группы не входят
    await newEvent(archivedOrg, ago(1))
    await newEvent(deletedOrg, ago(1))
    expect(eventA).toBeGreaterThan(0)
    const o = await overview()
    expect(o.northStar.activeThisWeek).toBe(2)
    expect(o.northStar.activePreviousWeek).toBe(2)
  })

  it('draft and cancelled events are not activity and not counted', async () => {
    await newEvent(orgA, ago(1), 'draft')
    await newEvent(orgA, ago(1), 'cancelled')
    const o = await overview()
    expect(o.northStar.activeThisWeek).toBe(0)
    expect(o.week.events).toEqual({ current: 0, previous: 0 })
    expect(o.gate.find((m) => m.key === 'totalEvents')!.value).toBe(0)
  })

  it('weekly counters use rolling 7-day windows and ignore cancelled bookings', async () => {
    const e1 = await newEvent(orgA, ago(1))
    await newEvent(orgA, ago(3))
    await newEvent(orgA, ago(8))
    await newEvent(orgA, ago(15)) // вне обоих окон
    await newEvent(orgA, ago(-1)) // будущее: ещё не состоялось
    await newBooking(orgA, e1, ago(0, 1))
    await newBooking(orgA, e1, ago(6))
    await newBooking(orgA, e1, ago(8))
    await newBooking(orgA, e1, ago(2), 'cancelled')
    await newBooking(orgA, e1, ago(2), 'waitlisted')
    const o = await overview()
    expect(o.week.events).toEqual({ current: 2, previous: 1 })
    // очередь и отмены — не записи
    expect(o.week.bookings).toEqual({ current: 2, previous: 1 })
  })

  it('bookingsDaily is 14 UTC days ending today with zero-filled gaps', async () => {
    const e1 = await newEvent(orgA, ago(1))
    await newBooking(orgA, e1, new Date('2026-11-18T00:00:01.000Z'))
    await newBooking(orgA, e1, new Date('2026-11-18T11:00:00.000Z'))
    await newBooking(orgA, e1, new Date('2026-11-17T23:59:59.000Z'))
    await newBooking(orgA, e1, new Date('2026-11-05T10:00:00.000Z'))
    await newBooking(orgA, e1, new Date('2026-11-04T23:59:59.000Z')) // за пределами 14 суток
    const o = await overview()
    expect(o.bookingsDaily).toHaveLength(14)
    expect(o.bookingsDaily[0]).toEqual({ date: '2026-11-05', count: 1 })
    expect(o.bookingsDaily[12]).toEqual({ date: '2026-11-17', count: 1 })
    expect(o.bookingsDaily[13]).toEqual({ date: '2026-11-18', count: 2 })
    expect(o.bookingsDaily.filter((d) => d.count === 0)).toHaveLength(11)
  })

  it('gate metrics: active organizers, 4-week retention, totals with targets', async () => {
    // A: событие в каждой из 4 последних недель — ретеншн; B: только 20 суток назад
    for (const d of [3, 10, 17, 24]) await newEvent(orgA, ago(d))
    await newEvent(orgB, ago(20))
    // архивная группа не считается ни в одной метрике
    await newEvent(archivedOrg, ago(2))
    const e = await newEvent(orgA, ago(40))
    await newBooking(orgA, e, ago(40))
    const o = await overview()
    const gate = Object.fromEntries(o.gate.map((m) => [m.key, m]))
    expect(gate.activeOrganizers).toEqual({
      key: 'activeOrganizers',
      value: 2,
      target: 2,
      reached: true,
    })
    expect(gate.retention4weeks).toEqual({
      key: 'retention4weeks',
      value: 1,
      target: 1,
      reached: true,
    })
    expect(gate.totalEvents).toEqual({ key: 'totalEvents', value: 6, target: 50, reached: false })
    expect(gate.totalBookings).toEqual({
      key: 'totalBookings',
      value: 1,
      target: 200,
      reached: false,
    })
  })

  it('a gap week breaks retention', async () => {
    for (const d of [3, 10, 24]) await newEvent(orgA, ago(d))
    const o = await overview()
    expect(o.gate.find((m) => m.key === 'retention4weeks')).toMatchObject({
      value: 0,
      reached: false,
    })
  })
})
