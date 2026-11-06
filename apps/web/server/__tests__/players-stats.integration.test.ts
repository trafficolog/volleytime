import { eventService, memberService, organizationService } from '@volley-time/core'
import {
  bookings,
  closeDb,
  db,
  events,
  organizations,
  payments,
  subscriptionPlans,
  subscriptions,
  users,
} from '@volley-time/db'
import type { PlayerStats } from '@volley-time/shared'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { createTestApi } from './harness'

type Api = Awaited<ReturnType<typeof createTestApi>>
type StatsMember = { id: number; user: { id: number }; stats?: PlayerStats }

const day = (offset: number) =>
  new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10)

/**
 * Статистика игроков в списке участников (21.2.20): только управляющий своей группы; игрок,
 * чужой управляющий и аноним агрегатов не получают; обычный список не меняется.
 */
describe('players stats in the members list (HTTP)', { timeout: 60_000 }, () => {
  let request: Api
  let owner: number
  let player: number
  let other: number
  let outsider: number
  let foreignOwner: number
  let orgId: number
  let foreignOrgId: number
  const base = (org = orgId) => `/api/organizations/${org}/members`
  const withStats = `stats=1&from=${day(-5)}&to=${day(5)}`

  beforeAll(async () => {
    request = await createTestApi()
    await db.delete(organizations)
    await db.delete(users)
    const people = await db
      .insert(users)
      .values([
        { name: 'Owner' },
        { name: 'Player' },
        { name: 'Other player' },
        { name: 'Outsider' },
        { name: 'Foreign owner' },
        { name: 'Foreign player' },
      ])
      .returning()
    owner = people[0]!.id
    player = people[1]!.id
    other = people[2]!.id
    outsider = people[3]!.id
    foreignOwner = people[4]!.id
    const foreignPlayer = people[5]!.id
    orgId = (await organizationService.create({ userId: owner }, { name: 'Stats' })).id
    await memberService.add({ userId: owner }, { organizationId: orgId, userId: player })
    await memberService.add({ userId: owner }, { organizationId: orgId, userId: other })
    foreignOrgId = (
      await organizationService.create({ userId: foreignOwner }, { name: 'Stats foreign' })
    ).id
    await memberService.add(
      { userId: foreignOwner },
      { organizationId: foreignOrgId, userId: foreignPlayer },
    )
    const mk = (title: string) => ({
      title,
      startsAt: new Date(Date.now() + 86_400_000),
      endsAt: new Date(Date.now() + 93_600_000),
      capacity: 6,
      price: 1500,
    })
    const eventId = (await eventService.create({ userId: owner }, orgId, mk('Основа'))).id
    const foreignEventId = (
      await eventService.create({ userId: foreignOwner }, foreignOrgId, mk('Чужое'))
    ).id
    await db.update(events).set({ status: 'published' })
    const [, pending, foreignPending] = await db
      .insert(bookings)
      .values([
        {
          eventId,
          userId: player,
          organizationId: orgId,
          status: 'attended',
          method: 'cash',
          seats: 1,
        },
        {
          eventId,
          userId: other,
          organizationId: orgId,
          status: 'pending_payment',
          method: 'cash',
        },
        {
          eventId: foreignEventId,
          userId: foreignPlayer,
          organizationId: foreignOrgId,
          status: 'pending_payment',
          method: 'cash',
        },
      ])
      .returning()
    await db.insert(payments).values([
      {
        organizationId: orgId,
        userId: other,
        bookingId: pending!.id,
        bookingIncarnation: pending!.incarnation,
        amount: 1500,
        method: 'cash',
        status: 'pending',
      },
      {
        organizationId: foreignOrgId,
        userId: foreignPlayer,
        bookingId: foreignPending!.id,
        bookingIncarnation: foreignPending!.incarnation,
        amount: 9900,
        method: 'cash',
        status: 'pending',
      },
    ])
    const plan = (
      await db
        .insert(subscriptionPlans)
        .values({ organizationId: orgId, name: 'P-8', totalSessions: 8, price: 8000 })
        .returning()
    )[0]!
    await db.insert(subscriptions).values({
      organizationId: orgId,
      userId: player,
      planId: plan.id,
      totalSessions: 8,
      usedSessions: 3,
      status: 'active',
    })
  })
  afterAll(async () => {
    await db.delete(organizations)
    await db.delete(users)
    await closeDb()
  })

  it('gives the manager attendance, subscription and debt per member of their group', async () => {
    const res = await request('GET', `${base()}?${withStats}`, { user: owner })
    expect(res.status).toBe(200)
    expect(res.headers.get('cache-control')).toBe('no-store')
    const body = res.body as { members: StatsMember[]; statsPeriod: { from: string; to: string } }
    expect(body.statsPeriod).toEqual({ from: day(-5), to: day(5) })
    const byUser = new Map(body.members.map((m) => [m.user.id, m.stats!]))
    expect(byUser.get(player)).toMatchObject({
      attendance: { visits: 1, noShows: 0 },
      subscription: { remaining: 5, total: 8 },
      debt: { amount: 0, seats: 0 },
    })
    expect(byUser.get(other)).toMatchObject({
      attendance: { visits: 0 },
      subscription: null,
      debt: { amount: 1500, seats: 1, currency: 'BYN' },
    })
    expect(byUser.get(owner)).toBeDefined()
  })

  it('uses the default window when no period is given', async () => {
    const res = await request('GET', `${base()}?stats=1`, { user: owner })
    expect(res.status).toBe(200)
    const body = res.body as { statsPeriod: { from: string; to: string } }
    expect(body.statsPeriod.to).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('leaves the plain list unchanged: no stats, no period', async () => {
    for (const user of [owner, player]) {
      const res = await request('GET', base(), { user })
      expect(res.status).toBe(200)
      const body = res.body as { members: StatsMember[]; statsPeriod?: unknown }
      expect(body.statsPeriod).toBeUndefined()
      for (const m of body.members) expect(m.stats).toBeUndefined()
    }
    const off = await request('GET', `${base()}?stats=0`, { user: owner })
    expect((off.body as { members: StatsMember[] }).members[0]!.stats).toBeUndefined()
  })

  it('refuses stats to a player, an outsider and an anonymous caller', async () => {
    expect((await request('GET', `${base()}?${withStats}`, { user: player })).status).toBe(403)
    expect((await request('GET', `${base()}?stats=1`, { user: player })).status).toBe(403)
    expect((await request('GET', `${base()}?${withStats}`, { user: outsider })).status).toBe(403)
    expect((await request('GET', `${base()}?${withStats}`)).status).toBe(401)
  })

  it('never leaks other players figures into a player response', async () => {
    const res = await request('GET', `${base()}?${withStats}`, { user: player })
    expect(JSON.stringify(res.body)).not.toContain('"debt"')
    expect(JSON.stringify(res.body)).not.toContain('"attendance"')
  })

  it('does not let the manager of another group read these stats', async () => {
    expect((await request('GET', `${base()}?${withStats}`, { user: foreignOwner })).status).toBe(
      403,
    )
    expect(
      (await request('GET', `${base(foreignOrgId)}?${withStats}`, { user: owner })).status,
    ).toBe(403)
  })

  it('does not mix another group into the stats of a group', async () => {
    const foreign = (
      await request('GET', `${base(foreignOrgId)}?${withStats}`, { user: foreignOwner })
    ).body as { members: StatsMember[] }
    expect(foreign.members.map((m) => m.user.id)).not.toContain(player)
    const debt = foreign.members.reduce((acc, m) => acc + (m.stats?.debt.amount ?? 0), 0)
    expect(debt).toBe(9900)
    expect(foreign.members.reduce((acc, m) => acc + (m.stats?.attendance.visits ?? 0), 0)).toBe(0)
  })

  it('rejects an invalid period with 422', async () => {
    for (const q of [
      'stats=1&from=2026-05-31&to=2026-05-01',
      'stats=1&from=2026-05-01',
      'stats=1&from=2026-01-01&to=2027-06-01',
      'stats=1&from=abc&to=2026-05-01',
    ])
      expect((await request('GET', `${base()}?${q}`, { user: owner })).status).toBe(422)
  })
})
