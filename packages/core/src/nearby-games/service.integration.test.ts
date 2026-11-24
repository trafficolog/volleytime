import {
  closeDb,
  db,
  eq,
  events,
  groupPageModeration,
  organizationMembers,
  organizations,
  users,
} from '@volley-time/db'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'

import { bookingService } from '../bookings/service'
import { eventService } from '../events/service'
import { memberService } from '../members/service'
import { organizationService } from '../organizations/service'

import { nearbyGamesService } from './service'

/**
 * Task 30.3.3 (M-32): лента открытых игр рядом на реальном PostgreSQL. Даты фиксированы (2035 год,
 * будущее), «сейчас» передаётся в сервис явно: от часов и пояса раннера тест не зависит.
 */
describe('nearby games (30.3.3, PostgreSQL)', { timeout: 60_000 }, () => {
  let me: number
  let owner: number
  let ownerMine: number
  let orgMine: number
  const ctx = (userId: number) => ({ userId })
  const NOW = new Date('2035-03-01T00:00:00Z')
  const list = (query: Record<string, unknown> = { city: 'Минск' }) =>
    nearbyGamesService.list(ctx(me), query, NOW)

  async function user(tag: string): Promise<number> {
    const [u] = await db
      .insert(users)
      .values({ email: `ng-${tag}-${crypto.randomUUID()}@t.by`, name: `Игрок ${tag}` })
      .returning()
    return u!.id
  }
  /** Публичная группа города (страница включена) с владельцем `ownerId`. */
  async function group(
    ownerId: number,
    name: string,
    patch: Partial<typeof organizations.$inferInsert> = {},
  ): Promise<number> {
    const org = await organizationService.create(ctx(ownerId), { name })
    await db
      .update(organizations)
      .set({ city: 'Минск', publicPageEnabled: true, ...patch })
      .where(eq(organizations.id, org.id))
    return org.id
  }
  async function game(
    ownerId: number,
    org: number,
    title: string,
    startsAt = '2035-03-10T17:00:00Z',
    extra: Record<string, unknown> = {},
  ) {
    const start = new Date(startsAt)
    return eventService.create(ctx(ownerId), org, {
      title,
      startsAt: start,
      endsAt: new Date(start.getTime() + 2 * 3600_000),
      capacity: 4,
      price: 0,
      ...extra,
    })
  }
  const setStatus = (id: number, status: 'draft' | 'cancelled' | 'closed' | 'finished') =>
    db.update(events).set({ status }).where(eq(events.id, id))

  beforeEach(async () => {
    await db.delete(organizations)
    await db.delete(users)
    me = await user('me')
    owner = await user('owner')
    ownerMine = await user('ownerMine')
    orgMine = await group(ownerMine, 'Моя группа')
    await memberService.add(ctx(ownerMine), { organizationId: orgMine, userId: me })
  })

  afterAll(async () => {
    await db.delete(organizations)
    await db.delete(users)
    await closeDb()
  })

  it('lists open future games of other public groups of the city, soonest first', async () => {
    const orgA = await group(owner, 'Группа А')
    const late = await game(owner, orgA, 'Поздно', '2035-03-20T17:00:00Z')
    const early = await game(owner, orgA, 'Рано', '2035-03-10T17:00:00Z')
    const res = await list()
    expect(res.games.map((g) => g.id)).toEqual([early.id, late.id])
    expect(res.games[0]).toMatchObject({
      title: 'Рано',
      group: { id: orgA, name: 'Группа А', city: 'Минск' },
      capacity: 4,
      taken: 0,
      full: false,
      level: null,
    })
    expect(res.games[0]!.group.slug).toBeTruthy()
    expect(res.games[0]!.publicSlug).toMatch(/^[0-9a-f]{12}$/)
    expect(res.hasMore).toBe(false)
  })

  it('never lists invite-only (joinMode=invite) events', async () => {
    const orgA = await group(owner, 'Группа А')
    const invite = await game(owner, orgA, 'Закрытая')
    await db.update(events).set({ joinMode: 'invite' }).where(eq(events.id, invite.id))
    const open = await game(owner, orgA, 'Открытая')
    expect((await list()).games.map((g) => g.id)).toEqual([open.id])
  })

  it('never lists events of a group whose page is off, hidden by root, suspended or deleted', async () => {
    const off = await group(owner, 'Страница выключена', { publicPageEnabled: false })
    const hidden = await group(owner, 'Скрыта root')
    const noindex = await group(owner, 'Noindex root')
    const suspended = await group(owner, 'Приостановлена', { status: 'suspended' })
    const deleted = await group(owner, 'Удалена', {
      deletedAt: new Date('2034-12-01T00:00:00Z'),
      restoreUntil: new Date('2035-12-01T00:00:00Z'),
    })
    await db.insert(groupPageModeration).values([
      { organizationId: hidden, state: 'hidden', reasonCode: 'spam' },
      { organizationId: noindex, state: 'noindex', reasonCode: 'spam' },
    ])
    for (const org of [off, hidden, noindex, suspended, deleted]) await game(owner, org, `g${org}`)
    // noindex закрывает только поиск: страница группы открыта по ссылке, игра остаётся в ленте
    expect((await list()).games.map((g) => g.group.id)).toEqual([noindex])
  })

  it('never lists draft, cancelled, closed, finished or already started events', async () => {
    const orgA = await group(owner, 'Группа А')
    const draft = await game(owner, orgA, 'Черновик')
    const cancelled = await game(owner, orgA, 'Отменена')
    const closed = await game(owner, orgA, 'Запись закрыта')
    const finished = await game(owner, orgA, 'Завершена')
    const started = await game(owner, orgA, 'Началась', '2035-02-28T10:00:00Z')
    await setStatus(draft.id, 'draft')
    await setStatus(cancelled.id, 'cancelled')
    await setStatus(closed.id, 'closed')
    await setStatus(finished.id, 'finished')
    const ok = await game(owner, orgA, 'Нормальная')
    const ids = (await list()).games.map((g) => g.id)
    expect(ids).toEqual([ok.id])
    expect(ids).not.toContain(started.id)
  })

  it('excludes groups where I am an active member, keeps those I left', async () => {
    await game(ownerMine, orgMine, 'Моя игра')
    const left = await group(owner, 'Покинутая')
    await memberService.add(ctx(owner), { organizationId: left, userId: me })
    await db
      .update(organizationMembers)
      .set({ status: 'left' })
      .where(eq(organizationMembers.organizationId, left))
    const gone = await game(owner, left, 'Бывшая группа')
    expect((await list()).games.map((g) => g.id)).toEqual([gone.id])
  })

  it('filters by city ignoring case and extra spaces; other cities are not mixed in', async () => {
    const minsk = await group(owner, 'Минск', { city: '  минск ' })
    const brest = await group(owner, 'Брест', { city: 'Брест' })
    const nowhere = await group(owner, 'Без города', { city: null })
    const g1 = await game(owner, minsk, 'Минск-игра')
    await game(owner, brest, 'Брест-игра')
    await game(owner, nowhere, 'Игра без города')
    expect((await list({ city: 'Минск' })).games.map((g) => g.id)).toEqual([g1.id])
    expect((await list({ city: ' МИНСК  ' })).games.map((g) => g.id)).toEqual([g1.id])
  })

  it('level filter keeps events of that level and events open to any level', async () => {
    const orgA = await group(owner, 'Группа А')
    const v2 = await game(owner, orgA, 'В2', '2035-03-10T10:00:00Z', { level: 'v2' })
    const v4 = await game(owner, orgA, 'В4', '2035-03-11T10:00:00Z', { level: 'v4' })
    const any = await game(owner, orgA, 'Любой', '2035-03-12T10:00:00Z')
    const ids = async (level?: string) =>
      (await list({ city: 'Минск', ...(level ? { level } : {}) })).games.map((g) => g.id)
    expect(await ids('v2')).toEqual([v2.id, any.id])
    expect(await ids('v4')).toEqual([v4.id, any.id])
    expect(await ids('v4_plus')).toEqual([any.id])
    expect(await ids()).toEqual([v2.id, v4.id, any.id])
  })

  it('reports taken seats and the full state', async () => {
    const orgA = await group(owner, 'Группа А')
    const ev = await game(owner, orgA, 'Почти полная')
    for (const tag of ['p1', 'p2', 'p3']) {
      const player = await user(tag)
      await memberService.add(ctx(owner), { organizationId: orgA, userId: player })
      await bookingService.book(ctx(player), orgA, ev.id, { method: 'free', seats: 1 })
    }
    expect((await list()).games[0]).toMatchObject({ capacity: 4, taken: 3, full: false })
    await bookingService.book(ctx(owner), orgA, ev.id, { method: 'free', seats: 1 })
    expect((await list()).games[0]).toMatchObject({ taken: 4, full: true })
  })

  it('exposes only public fields: fixed price, but no roster, owner or payment data', async () => {
    const orgA = await group(owner, 'Группа А')
    await game(owner, orgA, 'Платная', undefined, { price: 1500 })
    const [row] = (await list()).games
    expect(row!.price).toEqual({ amount: 1500, currency: 'BYN' })
    expect(Object.keys(row!).sort()).toEqual(
      [
        'capacity',
        'endsAt',
        'full',
        'group',
        'id',
        'level',
        'place',
        'price',
        'publicSlug',
        'startsAt',
        'taken',
        'title',
      ].sort(),
    )
    expect(Object.keys(row!.group).sort()).toEqual(
      ['city', 'district', 'id', 'logoUpdatedAt', 'name', 'slug', 'timezone'].sort(),
    )
  })

  it('shows no price for a split-price event and 0 for a free one', async () => {
    const orgA = await group(owner, 'Группа А')
    const free = await game(owner, orgA, 'Бесплатная', '2035-03-10T10:00:00Z')
    const split = await game(owner, orgA, 'Складчина', '2035-03-11T10:00:00Z')
    await db
      .update(events)
      .set({ priceMode: 'split', price: 0, targetAmount: 6000 })
      .where(eq(events.id, split.id))
    const res = await list()
    expect(res.games.find((g) => g.id === free.id)!.price).toEqual({ amount: 0, currency: 'BYN' })
    expect(res.games.find((g) => g.id === split.id)!.price).toBeNull()
  })
  it('paginates with limit/offset and reports hasMore', async () => {
    const orgA = await group(owner, 'Группа А')
    const ids: number[] = []
    for (let i = 0; i < 3; i++)
      ids.push((await game(owner, orgA, `Игра ${i}`, `2035-03-1${i}T10:00:00Z`)).id)
    const first = await list({ city: 'Минск', limit: 2 })
    expect(first.games.map((g) => g.id)).toEqual(ids.slice(0, 2))
    expect(first.hasMore).toBe(true)
    const next = await list({ city: 'Минск', limit: 2, offset: 2 })
    expect(next.games.map((g) => g.id)).toEqual(ids.slice(2))
    expect(next.hasMore).toBe(false)
  })

  it('rejects missing city, unknown level and out-of-range paging', async () => {
    await expect(list({})).rejects.toThrow()
    await expect(list({ city: '   ' })).rejects.toThrow()
    await expect(list({ city: 'Минск', level: 'v9' })).rejects.toThrow()
    await expect(list({ city: 'Минск', limit: 0 })).rejects.toThrow()
    await expect(list({ city: 'Минск', limit: 51 })).rejects.toThrow()
    await expect(list({ city: 'Минск', offset: -1 })).rejects.toThrow()
  })
})
