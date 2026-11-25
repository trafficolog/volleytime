import { memberService, organizationService } from '@volley-time/core'
import { closeDb, db, organizations, users } from '@volley-time/db'
import { dateToZonedInput } from '@volley-time/shared'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import {
  eligibleCoachIds,
  planSeriesAssignment,
  upcomingSeriesEvents,
  type SeriesEventRow,
  type TeamMember,
} from '../../app/utils/team-settings'
import { createTestApi } from './harness'

const DAY = 86_400_000
const addDays = (date: string, n: number) =>
  new Date(Date.parse(`${date}T00:00:00Z`) + n * DAY).toISOString().slice(0, 10)
/** Среда через 3+ недели: даты серии не «протухают». */
function futureWednesday(): string {
  const start = addDays(dateToZonedInput(new Date(), 'Europe/Minsk').slice(0, 10), 21)
  const weekday = (new Date(`${start}T00:00:00Z`).getUTCDay() + 6) % 7
  return addDays(start, (9 - weekday) % 7)
}

type Json = Record<string, unknown>

/**
 * Task 30.1.2 (W-17): API, на которое опирается «Настройки → Команда» — доступ по ролям,
 * приглашение в команду на 24 часа, история ролей и назначение тренера на серию.
 */
describe('cabinet team settings API (HTTP integration, 30.1.2)', () => {
  let request: Awaited<ReturnType<typeof createTestApi>>
  let ownerId: number
  let organizerId: number
  let coachId: number
  let playerId: number
  let orgId: number
  let coachMemberId: number
  let playerMemberId: number
  const base = () => `/api/organizations/${orgId}`
  const ALL_STATUSES = 'active,pending,guest,blocked,left,rejected'

  async function newUser(tag: string) {
    const [u] = await db
      .insert(users)
      .values({ email: `ts-${tag}-${Math.random()}@t.by`, name: `Name ${tag}` })
      .returning()
    return u!.id
  }

  beforeAll(async () => {
    request = await createTestApi()
  })

  beforeEach(async () => {
    await db.delete(organizations)
    await db.delete(users)
    ownerId = await newUser('owner')
    organizerId = await newUser('organizer')
    coachId = await newUser('coach')
    playerId = await newUser('player')
    orgId = (await organizationService.create({ userId: ownerId }, { name: 'Team HTTP' })).id
    const add = async (userId: number, extra: Record<string, unknown> = {}) =>
      (await memberService.add({ userId: ownerId }, { organizationId: orgId, userId, ...extra })).id
    await add(organizerId, { role: 'organizer' })
    coachMemberId = await add(coachId, { role: 'coach' })
    playerMemberId = await add(playerId)
  })

  afterAll(async () => {
    await db.delete(organizations)
    await db.delete(users)
    await closeDb()
  })

  it('shows the team data to the owner and the organizer, and refuses coaches and players', async () => {
    const calls = (user: number) => [
      request('GET', `${base()}/members?statuses=${ALL_STATUSES}`, { user }),
      request('GET', `${base()}/audit?action=member.role_changed&entityType=member&limit=20`, {
        user,
      }),
    ]
    for (const user of [ownerId, organizerId]) {
      for (const res of await Promise.all(calls(user))) expect(res.status).toBe(200)
    }
    const [coachMembers, coachAudit] = await Promise.all(calls(coachId))
    expect(coachMembers!.status).toBe(403)
    expect(coachAudit!.status).toBe(403)
    const [playerMembers, playerAudit] = await Promise.all(calls(playerId))
    expect(playerMembers!.status).toBe(403)
    expect(playerAudit!.status).toBe(403)
    expect((await request('GET', `${base()}/members`, { user: ownerId })).status).toBe(200)
  })

  it('changes roles and the payment flag for the owner only and keeps the history with authors', async () => {
    const asRole = (user: number, memberId: number, body: Json) =>
      request('PATCH', `${base()}/members/${memberId}`, { user, body })
    expect((await asRole(organizerId, playerMemberId, { role: 'coach' })).status).toBe(403)
    expect((await asRole(coachId, coachMemberId, { canAcceptPayment: true })).status).toBe(403)
    expect((await asRole(playerId, coachMemberId, { role: 'player' })).status).toBe(403)

    expect((await asRole(ownerId, playerMemberId, { role: 'coach' })).status).toBe(200)
    expect((await asRole(ownerId, playerMemberId, { canAcceptPayment: true })).status).toBe(200)
    expect((await asRole(ownerId, playerMemberId, { role: 'player' })).status).toBe(200)

    const history = await request(
      'GET',
      `${base()}/audit?action=member.role_changed&entityType=member&limit=20`,
      { user: ownerId },
    )
    const entries = (history.body as { entries: Json[] }).entries
    // новые записи первыми; у каждой автор и id членства, по которым экран строит строку
    expect(entries.map((e) => e.newValue)).toEqual([
      { role: 'player', canAcceptPayment: false },
      { role: 'coach', canAcceptPayment: true },
      { role: 'coach', canAcceptPayment: false },
    ])
    for (const entry of entries) {
      expect(entry).toMatchObject({ userId: ownerId, entityId: playerMemberId })
    }
  })

  it('creates a team invite for 24 hours, single use; only the owner may invite a coach or organizer', async () => {
    const invite = (user: number, roleToAssign: string) =>
      request('POST', `${base()}/invites`, {
        user,
        body: { roleToAssign, expiresInDays: 1, maxUses: 1, defaultMemberStatus: 'active' },
      })
    const res = await invite(ownerId, 'coach')
    expect(res.status, res.text).toBe(200)
    const body = res.body as { invite: Json; deeplinkUrl: string }
    expect(body.invite).toMatchObject({ roleToAssign: 'coach', maxUses: 1 })
    expect(body.deeplinkUrl).toContain('t.me/')
    const hours = (new Date(String(body.invite.expiresAt)).getTime() - Date.now()) / 3_600_000
    expect(hours).toBeGreaterThan(23.9)
    expect(hours).toBeLessThanOrEqual(24)
    expect((await invite(ownerId, 'organizer')).status).toBe(200)

    for (const user of [organizerId, coachId, playerId]) {
      expect((await invite(user, 'coach')).status).toBe(403)
      expect((await invite(user, 'organizer')).status).toBe(403)
    }
  })

  it('assigns a coach to a series and shows it in «Ведёт» for managers only', async () => {
    const startDate = futureWednesday()
    const created = await request('POST', `${base()}/series`, {
      user: ownerId,
      body: {
        rule: { freq: 'weekly', weekdays: [3], startDate, count: 3 },
        template: { title: 'Среда', startTime: '19:00', durationMinutes: 120, capacity: 12 },
        idempotencyKey: `team-series-${Date.now()}`,
      },
    })
    expect(created.status, created.text).toBe(200)
    const seriesId = (created.body as { series: { id: number } }).series.id

    // экран берёт серии из списка событий и читает шаблон серии
    const list = await request('GET', `${base()}/events?limit=100`, { user: ownerId })
    const events = (list.body as { events: Json[] }).events
    expect(events.filter((e) => e.seriesId === seriesId)).toHaveLength(3)
    expect(events[0]).toHaveProperty('seriesDate')
    const series = await request('GET', `${base()}/series/${seriesId}`, { user: ownerId })
    const template = (series.body as { series: { template: Json } }).series.template
    expect(template.coachUserIds ?? []).toEqual([])

    // тренер добавляется к будущим датам; не-управляющие серию не правят
    const url = `${base()}/series/${seriesId}?scope=following&from=${startDate}`
    for (const user of [coachId, playerId]) {
      expect(
        (await request('PATCH', url, { user, body: { coachUserIds: [coachId] } })).status,
      ).toBe(403)
    }
    const assigned = await request('PATCH', url, {
      user: organizerId,
      body: { coachUserIds: [coachId] },
    })
    expect(assigned.status, assigned.text).toBe(200)

    const members = await request('GET', `${base()}/members`, { user: ownerId })
    const coach = (members.body as { members: { id: number; leads?: Json[] }[] }).members.find(
      (m) => m.id === coachMemberId,
    )!
    expect(coach.leads?.map((l) => l.seriesId)).toEqual([seriesId, seriesId, seriesId])
    const asPlayer = await request('GET', `${base()}/members`, { user: playerId })
    for (const m of (asPlayer.body as { members: Json[] }).members)
      expect(m).not.toHaveProperty('leads')

    // уход с роли тренера не трогает события: назначение остаётся данными события, прав не даёт
    expect(
      (
        await request('PATCH', `${base()}/members/${coachMemberId}`, {
          user: ownerId,
          body: { role: 'player' },
        })
      ).status,
    ).toBe(200)
  })

  it('assigns a coach to a series over the real API: keeps date coaches, drops a demoted one, template-only step leaves dates alone', async () => {
    const startDate = futureWednesday()
    const created = await request('POST', `${base()}/series`, {
      user: ownerId,
      body: {
        rule: { freq: 'weekly', weekdays: [3], startDate, count: 3 },
        template: { title: 'Среда', startTime: '19:00', durationMinutes: 120, capacity: 12 },
        idempotencyKey: `team-series-plan-${Date.now()}`,
      },
    })
    expect(created.status, created.text).toBe(200)
    const seriesId = (created.body as { series: { id: number } }).series.id
    const patch = (scope: string, from: string, coachUserIds: number[]) =>
      request('PATCH', `${base()}/series/${seriesId}?scope=${scope}&from=${from}`, {
        user: ownerId,
        body: { coachUserIds },
      })

    // стартовое состояние: coachId ведёт шаблон и все даты, у второй даты свой тренер coach2
    const coach2Id = await newUser('coach2')
    await memberService.add(
      { userId: ownerId },
      { organizationId: orgId, userId: coach2Id, role: 'coach' },
    )
    const newCoachId = await newUser('newcoach')
    await memberService.add(
      { userId: ownerId },
      { organizationId: orgId, userId: newCoachId, role: 'coach' },
    )
    expect((await patch('following', startDate, [coachId])).status).toBe(200)
    const listBefore = await request('GET', `${base()}/events?limit=100`, { user: ownerId })
    const rows = (listBefore.body as { events: SeriesEventRow[] }).events.filter(
      (e) => e.seriesId === seriesId,
    )
    expect(rows).toHaveLength(3)
    const secondDate = rows[1]!.seriesDate!
    expect((await patch('single', secondDate, [coachId, coach2Id])).status).toBe(200)

    // coachId понижен до игрока: сервер больше не принимает его в списках тренеров
    expect(
      (
        await request('PATCH', `${base()}/members/${coachMemberId}`, {
          user: ownerId,
          body: { role: 'player' },
        })
      ).status,
    ).toBe(200)
    const naive = await patch('following', startDate, [coachId, newCoachId])
    expect(naive.status).toBeGreaterThanOrEqual(400)

    // то же, что делает диалог: читает шаблон, даты и участников, затем правит шаблон и даты
    const readEvents = async () =>
      (
        (await request('GET', `${base()}/events?limit=100`, { user: ownerId })).body as {
          events: SeriesEventRow[]
        }
      ).events
        .filter((e) => e.seriesId === seriesId)
        .sort((a, b) => a.seriesDate!.localeCompare(b.seriesDate!))
    const members = (
      (await request('GET', `${base()}/members?statuses=${ALL_STATUSES}`, { user: ownerId }))
        .body as { members: TeamMember[] }
    ).members
    const series = await request('GET', `${base()}/series/${seriesId}`, { user: ownerId })
    const template = (series.body as { series: { template: { coachUserIds?: number[] } } }).series
      .template.coachUserIds
    const upcoming = upcomingSeriesEvents(await readEvents(), seriesId, startDate, new Date())
    expect(upcoming).toHaveLength(3)
    const plan = planSeriesAssignment(
      template ?? [],
      upcoming,
      newCoachId,
      eligibleCoachIds(members),
    )
    expect(plan.template).toEqual([newCoachId])

    // шаблон: from=9999-12-31 меняет только шаблон, даты не затрагиваются
    const datesBefore = await readEvents()
    expect((await patch('following', '9999-12-31', plan.template!)).status).toBe(200)
    expect(await readEvents()).toEqual(datesBefore)
    const after = await request('GET', `${base()}/series/${seriesId}`, { user: ownerId })
    expect(
      (after.body as { series: { template: { coachUserIds?: number[] } } }).series.template
        .coachUserIds,
    ).toEqual([newCoachId])

    for (const d of plan.dates)
      expect((await patch('single', d.date, d.coachUserIds)).status).toBe(200)
    const final = await readEvents()
    expect(final.map((e) => e.coachUserIds)).toEqual([
      [newCoachId],
      [coach2Id, newCoachId],
      [newCoachId],
    ])
  })
})
