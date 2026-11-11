import { eventService, memberService, organizationService } from '@volley-time/core'
import {
  bookings,
  closeDb,
  db,
  eq,
  events,
  organizationMembers,
  organizations,
  users,
} from '@volley-time/db'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { createTestApi } from './harness'

type Api = Awaited<ReturnType<typeof createTestApi>>
interface OwnStats {
  attendance: { visits: number; noShows: number; ratePercent: number | null }
  period: { from: string; to: string }
}

/**
 * Статистика игрока в его профиле (21.4.8, M-13): `GET /members/me/stats` отдаёт только свои
 * посещения, неявки и долю посещаемости в текущей группе — теми же агрегатами, что список игроков
 * организатора (21.2.20). Чужие игроки, чужие группы и чужие поля (долг, абонемент) в ответ не
 * попадают; пользователь не может подменить `userId` параметром.
 */
describe('own player stats (HTTP)', { timeout: 60_000 }, () => {
  let request: Api
  let owner: number
  let player: number
  let rival: number
  let outsider: number
  let applicant: number
  let left: number
  let blocked: number
  let orgId: number
  let otherOrgId: number
  const path = (org = orgId) => `/api/organizations/${org}/members/me/stats`

  beforeAll(async () => {
    request = await createTestApi()
    await db.delete(organizations)
    await db.delete(users)
    const people = await db
      .insert(users)
      .values([
        { name: 'Owner' },
        { name: 'Player' },
        { name: 'Rival' },
        { name: 'Outsider' },
        { name: 'Applicant' },
        { name: 'Left' },
        { name: 'Blocked' },
      ])
      .returning()
    owner = people[0]!.id
    player = people[1]!.id
    rival = people[2]!.id
    outsider = people[3]!.id
    applicant = people[4]!.id
    left = people[5]!.id
    blocked = people[6]!.id
    orgId = (await organizationService.create({ userId: owner }, { name: 'Own stats' })).id
    otherOrgId = (await organizationService.create({ userId: owner }, { name: 'Own stats 2' })).id
    for (const id of [player, rival, applicant, left, blocked]) {
      await memberService.add({ userId: owner }, { organizationId: orgId, userId: id })
    }
    await memberService.add({ userId: owner }, { organizationId: otherOrgId, userId: player })
    await db
      .update(organizationMembers)
      .set({ status: 'pending' })
      .where(eq(organizationMembers.userId, applicant))
    await db
      .update(organizationMembers)
      .set({ status: 'left' })
      .where(eq(organizationMembers.userId, left))
    await db
      .update(organizationMembers)
      .set({ status: 'blocked' })
      .where(eq(organizationMembers.userId, blocked))

    const mk = async (org: number, title: string, daysAgo: number) => {
      const created = await eventService.create({ userId: owner }, org, {
        title,
        startsAt: new Date(Date.now() + 86_400_000),
        endsAt: new Date(Date.now() + 93_600_000),
        capacity: 10,
        price: 1000,
      })
      const startsAt = new Date(Date.now() - daysAgo * 86_400_000)
      await db
        .update(events)
        .set({ status: 'published', startsAt, endsAt: new Date(startsAt.getTime() + 7_200_000) })
        .where(eq(events.id, created.id))
      return created.id
    }
    const e1 = await mk(orgId, 'E1', 5)
    const e2 = await mk(orgId, 'E2', 6)
    const e3 = await mk(orgId, 'E3', 7)
    const foreign = await mk(otherOrgId, 'Foreign', 5)
    const row = (
      eventId: number,
      userId: number,
      status: 'attended' | 'no_show',
      organizationId = orgId,
    ) => ({ eventId, userId, organizationId, status, method: 'cash' as const, seats: 1 })
    await db
      .insert(bookings)
      .values([
        row(e1, player, 'attended'),
        row(e2, player, 'attended'),
        row(e3, player, 'no_show'),
        row(foreign, player, 'attended', otherOrgId),
        row(e1, rival, 'attended'),
        row(e2, rival, 'attended'),
        row(e3, rival, 'attended'),
      ])
  })
  afterAll(async () => {
    await db.delete(organizations)
    await db.delete(users)
    await closeDb()
  })

  it('returns the own visits, no-shows and attendance rate of this group only', async () => {
    const res = await request('GET', path(), { user: player })
    expect(res.status).toBe(200)
    expect(res.headers.get('cache-control')).toBe('no-store')
    const body = res.body as OwnStats
    expect(body.attendance).toEqual({ visits: 2, noShows: 1, ratePercent: 67 })
    expect(body.period.to).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('does not count another group of the same player', async () => {
    const res = await request('GET', path(otherOrgId), { user: player })
    expect((res.body as OwnStats).attendance).toEqual({ visits: 1, noShows: 0, ratePercent: 100 })
  })

  it('shows another player only their own figures', async () => {
    const res = await request('GET', path(), { user: rival })
    expect((res.body as OwnStats).attendance).toEqual({ visits: 3, noShows: 0, ratePercent: 100 })
  })

  it('has no attendance rate for a member without visits', async () => {
    const res = await request('GET', path(), { user: owner })
    expect(res.status).toBe(200)
    expect((res.body as OwnStats).attendance).toEqual({ visits: 0, noShows: 0, ratePercent: null })
  })

  it('ignores a foreign userId in the query and exposes no money or subscription fields', async () => {
    const res = await request('GET', `${path()}?userId=${rival}&stats=1`, { user: player })
    expect((res.body as OwnStats).attendance.visits).toBe(2)
    const text = JSON.stringify(res.body)
    for (const leak of ['debt', 'subscription', 'cancellations', 'lastVisitAt', 'name'])
      expect(text).not.toContain(leak)
  })

  it('refuses a member who left and a blocked member (left, blocked)', async () => {
    for (const [user, code] of [
      [left, 'permission.no_longer_member'],
      [blocked, 'permission.blocked'],
    ] as const) {
      const res = await request('GET', path(), { user })
      expect(res.status).toBe(403)
      expect(JSON.stringify(res.body)).toContain(code)
    }
  })

  it('refuses an outsider, an applicant, another group and an anonymous caller', async () => {
    expect((await request('GET', path(), { user: outsider })).status).toBe(403)
    expect((await request('GET', path(), { user: applicant })).status).toBe(403)
    expect((await request('GET', path(otherOrgId), { user: rival })).status).toBe(403)
    expect((await request('GET', path())).status).toBe(401)
  })
})
