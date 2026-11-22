import { bookingService, eventService, memberService, organizationService } from '@volley-time/core'
import { closeDb, db, organizations, users } from '@volley-time/db'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { createTestApi } from './harness'

/**
 * Task 23.2.2 (M-10): HTTP-контракт `GET /api/me/calendar`. Все группы игрока — одним запросом;
 * нет сессии — 401, чужие группы и события недоступны, неверный диапазон — 422.
 */
describe('me calendar API (HTTP integration)', () => {
  let request: Awaited<ReturnType<typeof createTestApi>>
  let me: number
  let stranger: number
  let orgA: number
  let orgB: number
  let foreignOrg: number
  let ownerA: number
  let ownerB: number

  const newUser = async (tag: string) =>
    (
      await db
        .insert(users)
        .values({ email: `mc-${tag}-${Math.random()}@t.by` })
        .returning()
    )[0]!.id
  const game = (owner: number, org: number, title: string, day: number) =>
    eventService.create({ userId: owner }, org, {
      title,
      startsAt: new Date(`2035-03-${day}T17:00:00Z`),
      endsAt: new Date(`2035-03-${day}T19:00:00Z`),
      capacity: 6,
      price: 0,
    })
  const q = '?from=2035-03-01&to=2035-03-31'

  beforeAll(async () => {
    request = await createTestApi()
  })

  beforeEach(async () => {
    await db.delete(organizations)
    await db.delete(users)
    me = await newUser('me')
    stranger = await newUser('stranger')
    ownerA = await newUser('ownerA')
    ownerB = await newUser('ownerB')
    orgA = (await organizationService.create({ userId: ownerA }, { name: 'Группа А' })).id
    orgB = (await organizationService.create({ userId: ownerB }, { name: 'Группа Б' })).id
    foreignOrg = (await organizationService.create({ userId: stranger }, { name: 'Чужая' })).id
    await memberService.add({ userId: ownerA }, { organizationId: orgA, userId: me })
    await memberService.add({ userId: ownerB }, { organizationId: orgB, userId: me })
  })

  afterAll(async () => {
    await db.delete(organizations)
    await db.delete(users)
    await closeDb()
  })

  it('requires a session', async () => {
    expect((await request('GET', `/api/me/calendar${q}`)).status).toBe(401)
  })

  it('returns games of every group of the player in one response, with my booking', async () => {
    const a = await game(ownerA, orgA, 'Игра группы А', 10)
    const b = await game(ownerB, orgB, 'Игра группы Б', 11)
    await game(stranger, foreignOrg, 'Чужая игра', 12)
    await bookingService.book({ userId: me }, orgA, a.id, { method: 'free' })
    const res = await request('GET', `/api/me/calendar${q}`, { user: me })
    expect(res.status).toBe(200)
    const body = res.body as {
      groups: { id: number }[]
      events: { id: number; organizationId: number; myBooking: { status: string } | null }[]
    }
    expect(body.groups.map((g) => g.id)).toEqual([orgA, orgB].sort((x, y) => x - y))
    expect(body.events.map((e) => e.id)).toEqual([a.id, b.id])
    expect(body.events[0]).toMatchObject({
      organizationId: orgA,
      myBooking: { status: 'confirmed' },
    })
    expect(body.events[1]!.myBooking).toBeNull()
  })

  it("does not show another player's data: a stranger sees only their own groups", async () => {
    await game(ownerA, orgA, 'Игра группы А', 10)
    const res = await request('GET', `/api/me/calendar${q}`, { user: stranger })
    expect(res.status).toBe(200)
    expect((res.body as { events: unknown[] }).events).toEqual([])
  })

  it('rejects a missing, reversed or too wide range with 422', async () => {
    for (const query of [
      '',
      '?from=2035-03-01',
      '?from=2035-03-31&to=2035-03-01',
      '?from=2035-01-01&to=2035-12-31',
      '?from=bad&to=worse',
    ])
      expect((await request('GET', `/api/me/calendar${query}`, { user: me })).status).toBe(422)
  })
})
