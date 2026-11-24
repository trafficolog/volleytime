import { eventService, memberService, organizationService } from '@volley-time/core'
import { closeDb, db, eq, organizations, users } from '@volley-time/db'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { createTestApi } from './harness'

/**
 * Task 30.3.3 (M-32): HTTP-контракт `GET /api/me/nearby-games`. Нет сессии — 401, неверные
 * параметры — 422; чужая закрытая группа и события «по приглашению» в ответ не попадают.
 */
describe('me nearby games API (HTTP integration)', () => {
  let request: Awaited<ReturnType<typeof createTestApi>>
  let me: number
  let owner: number
  let orgOpen: number
  let orgPrivate: number

  const newUser = async (tag: string) =>
    (
      await db
        .insert(users)
        .values({ email: `ng-${tag}-${Math.random()}@t.by` })
        .returning()
    )[0]!.id
  const game = (org: number, title: string, day: number, extra: Record<string, unknown> = {}) =>
    eventService.create({ userId: owner }, org, {
      title,
      startsAt: new Date(`2035-03-${day}T17:00:00Z`),
      endsAt: new Date(`2035-03-${day}T19:00:00Z`),
      capacity: 6,
      price: 0,
      ...extra,
    })

  beforeAll(async () => {
    request = await createTestApi()
  })

  beforeEach(async () => {
    await db.delete(organizations)
    await db.delete(users)
    me = await newUser('me')
    owner = await newUser('owner')
    orgOpen = (await organizationService.create({ userId: owner }, { name: 'Открытая группа' })).id
    orgPrivate = (await organizationService.create({ userId: owner }, { name: 'Закрытая группа' }))
      .id
    await db
      .update(organizations)
      .set({ city: 'Минск', publicPageEnabled: true })
      .where(eq(organizations.id, orgOpen))
    await db
      .update(organizations)
      .set({ city: 'Минск', publicPageEnabled: false })
      .where(eq(organizations.id, orgPrivate))
  })

  afterAll(async () => {
    await db.delete(organizations)
    await db.delete(users)
    await closeDb()
  })

  const q = `?city=${encodeURIComponent('Минск')}`

  it('requires a session', async () => {
    expect((await request('GET', `/api/me/nearby-games${q}`)).status).toBe(401)
  })

  it('returns open games of public groups only, with public fields', async () => {
    const open = await game(orgOpen, 'Открытая игра', 10, { level: 'v2' })
    await game(orgPrivate, 'Игра закрытой группы', 11)
    const res = await request('GET', `/api/me/nearby-games${q}`, { user: me })
    expect(res.status).toBe(200)
    const body = res.body as { games: { id: number; group: { slug: string } }[]; hasMore: boolean }
    expect(body.games.map((g) => g.id)).toEqual([open.id])
    expect(body.hasMore).toBe(false)
    expect(JSON.stringify(body)).not.toMatch(/email|userId|createdBy|bookings/i)
  })

  it('applies the level filter', async () => {
    const v2 = await game(orgOpen, 'Игра В2', 10, { level: 'v2' })
    const v4 = await game(orgOpen, 'Игра В4', 11, { level: 'v4' })
    const res = await request('GET', `/api/me/nearby-games${q}&level=v4`, { user: me })
    const ids = (res.body as { games: { id: number }[] }).games.map((g) => g.id)
    expect(ids).toEqual([v4.id])
    expect(ids).not.toContain(v2.id)
  })

  it('does not list groups where the caller is an active member', async () => {
    await game(orgOpen, 'Игра группы', 10)
    await memberService.add({ userId: owner }, { organizationId: orgOpen, userId: me })
    const res = await request('GET', `/api/me/nearby-games${q}`, { user: me })
    expect((res.body as { games: unknown[] }).games).toEqual([])
  })

  it('rejects a missing city, unknown level and bad paging with 422', async () => {
    for (const query of [
      '',
      '?city=',
      `${q}&level=v9`,
      `${q}&limit=0`,
      `${q}&limit=99`,
      `${q}&offset=-1`,
    ])
      expect((await request('GET', `/api/me/nearby-games${query}`, { user: me })).status).toBe(422)
  })
})
