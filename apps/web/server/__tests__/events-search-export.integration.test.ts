import { memberService, organizationService } from '@volley-time/core'
import { closeDb, db, eq, events, organizations, users, venues } from '@volley-time/db'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { createTestApi } from './harness'

interface ListBody {
  total: number
  events: { id: number; title: string; status: string }[]
}

/**
 * Task 21.2.10: поиск, фильтры, страницы со счётчиком «из M» и CSV списка событий кабинета;
 * черновики не раскрываются игроку, выгрузка — только manager и только своя группа.
 */
describe('cabinet events: search, pagination and export (21.2.10)', () => {
  let request: Awaited<ReturnType<typeof createTestApi>>
  let ownerId: number
  let playerId: number
  let outsiderId: number
  let orgId: number
  let otherOrgId: number
  let hallId: number
  let otherHallId: number
  const day = 86_400_000
  const base = () => `/api/organizations/${orgId}/events`
  const mk = async (over: Record<string, unknown> = {}, org = orgId) => {
    const [row] = await db
      .insert(events)
      .values({
        organizationId: org,
        createdByUserId: ownerId,
        title: 'Игра',
        startsAt: new Date(Date.now() + 2 * day),
        capacity: 10,
        price: 0,
        currency: 'BYN',
        ...over,
        endsAt: new Date(
          ((over.startsAt as Date | undefined) ?? new Date(Date.now() + 2 * day)).getTime() +
            7_200_000,
        ),
      })
      .returning()
    return row!
  }
  const list = async (user: number, query = '', id = orgId) => {
    const res = await request(
      'GET',
      `/api/organizations/${id}/events?${query.includes('filter=') ? '' : 'filter=all'}${query}`,
      {
        user,
      },
    )
    expect(res.status, JSON.stringify(res.body)).toBe(200)
    return res.body as ListBody
  }
  const titles = (b: ListBody) => b.events.map((e) => e.title)
  const newUser = async (tag: string) =>
    (
      await db
        .insert(users)
        .values({ email: `ese-${tag}-${crypto.randomUUID()}@t.by` })
        .returning()
    )[0]!.id

  beforeAll(async () => {
    request = await createTestApi()
  })
  beforeEach(async () => {
    ownerId = await newUser('owner')
    playerId = await newUser('player')
    outsiderId = await newUser('outsider')
    orgId = (await organizationService.create({ userId: ownerId }, { name: 'Search group' })).id
    otherOrgId = (await organizationService.create({ userId: outsiderId }, { name: 'Foreign' })).id
    await memberService.add({ userId: ownerId }, { organizationId: orgId, userId: playerId })
    hallId = (
      await db.insert(venues).values({ organizationId: orgId, name: 'Школа №24' }).returning()
    )[0]!.id
    otherHallId = (
      await db
        .insert(venues)
        .values({ organizationId: otherOrgId, name: 'Школа чужая' })
        .returning()
    )[0]!.id
  })
  afterEach(async () => {
    await db.delete(organizations).where(eq(organizations.id, orgId))
    await db.delete(organizations).where(eq(organizations.id, otherOrgId))
  })
  afterAll(closeDb)

  it('searches by title, venue name and free-form place, case-insensitively', async () => {
    await mk({ title: 'Основа вечер', venueId: hallId })
    await mk({ title: 'Турнир', locationText: 'Парк Горького' })
    await mk({ title: 'Утренняя', startsAt: new Date(Date.now() + 3 * day) })
    expect(titles(await list(ownerId, '&q=ОСНОВА'))).toEqual(['Основа вечер'])
    expect(titles(await list(ownerId, '&q=школа'))).toEqual(['Основа вечер'])
    expect(titles(await list(ownerId, '&q=горького'))).toEqual(['Турнир'])
    const none = await list(ownerId, '&q=несуществует')
    expect(none).toMatchObject({ total: 0, events: [] })
    // пустой и состоящий из пробелов запрос — без поиска
    expect((await list(ownerId, '&q=%20%20')).total).toBe(3)
  })

  it('treats %, _ and \\ in the query literally', async () => {
    await mk({ title: '100% игра' })
    await mk({ title: 'Просто игра' })
    await mk({ title: 'a_b' })
    expect(titles(await list(ownerId, '&q=100%25'))).toEqual(['100% игра'])
    expect(titles(await list(ownerId, '&q=%25'))).toEqual(['100% игра'])
    expect(titles(await list(ownerId, '&q=a_b'))).toEqual(['a_b'])
    expect(titles(await list(ownerId, '&q=_'))).toEqual(['a_b'])
    expect((await list(ownerId, '&q=%5C')).total).toBe(0)
    // SQL-фрагмент — обычный текст
    expect((await list(ownerId, `&q=${encodeURIComponent("'; DROP TABLE events;--")}`)).total).toBe(
      0,
    )
    expect((await list(ownerId)).total).toBe(3)
  })

  it('filters by venue and by period (org calendar days, inclusive bounds)', async () => {
    const inHall = await mk({ title: 'В зале', venueId: hallId })
    await mk({ title: 'Без зала' })
    expect(titles(await list(ownerId, `&venueId=${hallId}`))).toEqual(['В зале'])
    // чужой зал не раскрывает ничего и не ломает запрос
    expect(await list(ownerId, `&venueId=${otherHallId}`)).toMatchObject({ total: 0, events: [] })

    const iso = (d: Date) => d.toISOString().slice(0, 10)
    const day1 = iso(inHall.startsAt)
    const exact = await list(ownerId, `&from=${day1}&to=${day1}`)
    expect(exact.total).toBe(2)
    const before = await list(ownerId, `&from=2000-01-01&to=2000-01-02`)
    expect(before.total).toBe(0)
    const combined = await list(ownerId, `&from=${day1}&to=${day1}&venueId=${hallId}&q=зал`)
    expect(titles(combined)).toEqual(['В зале'])
  })

  it('reports total independent of the page and pages stably through ties', async () => {
    const startsAt = new Date(Date.now() + 2 * day)
    for (let i = 0; i < 7; i++) await mk({ title: `Равное ${i}`, startsAt })
    await mk({ title: 'Позже', startsAt: new Date(Date.now() + 5 * day) })
    const seen: string[] = []
    for (const offset of [0, 3, 6]) {
      const page = await list(ownerId, `&limit=3&offset=${offset}`)
      expect(page.total).toBe(8)
      seen.push(...titles(page))
    }
    expect(seen).toHaveLength(8)
    expect(new Set(seen).size).toBe(8)
    // страница за последней — пусто, но total сохраняется
    expect(await list(ownerId, '&limit=3&offset=9')).toMatchObject({ total: 8, events: [] })
    // total учитывает поиск и фишку статуса
    await mk({ title: 'Равное x', status: 'cancelled', startsAt })
    expect((await list(ownerId, '&q=равное&limit=2')).total).toBe(8)
    expect((await list(ownerId, '&q=равное&status=cancelled&limit=2')).total).toBe(1)
    expect((await list(ownerId, '&filter=past&limit=2')).total).toBe(0)
  })

  it('never reveals drafts to a non-manager through search, status or count', async () => {
    await mk({ title: 'Секретный черновик', status: 'draft' })
    await mk({ title: 'Открытая игра' })
    expect(titles(await list(ownerId, '&q=секретный'))).toEqual(['Секретный черновик'])
    for (const query of ['&q=секретный', '&status=draft', '&q=черновик&status=draft', '']) {
      const asPlayer = await list(playerId, query)
      expect(asPlayer.events.map((e) => e.status)).not.toContain('draft')
      expect(titles(asPlayer)).not.toContain('Секретный черновик')
    }
    expect((await list(playerId, '&q=секретный')).total).toBe(0)
    expect((await list(playerId)).total).toBe(1)
    expect((await list(ownerId)).total).toBe(2)
  })

  it('never returns events of another group, with or without filters', async () => {
    await mk({ title: 'Чужая уникальная', venueId: otherHallId }, otherOrgId)
    await mk({ title: 'Своя' })
    expect((await list(ownerId, '&q=уникальная')).total).toBe(0)
    expect((await list(ownerId, `&venueId=${otherHallId}`)).total).toBe(0)
    expect(titles(await list(ownerId))).toEqual(['Своя'])
    // чужая группа целиком закрыта
    const res = await request('GET', `/api/organizations/${otherOrgId}/events?filter=all`, {
      user: ownerId,
    })
    expect(res.status).toBe(403)
  })

  it('validates search and venue parameters', async () => {
    for (const bad of ['venueId=0', 'venueId=abc', `q=${'я'.repeat(201)}`, 'limit=101']) {
      const res = await request('GET', `${base()}?filter=all&${bad}`, { user: ownerId })
      expect(res.status, bad).toBe(422)
    }
  })

  describe('CSV export', () => {
    const csv = (query = '', user = ownerId, id = orgId) =>
      request('GET', `/api/organizations/${id}/events/export?filter=all${query}`, { user })
    const lines = (text: string) => text.replace('﻿', '').trimEnd().split('\r\n')

    it('exports the filtered list with ";" separator and dated file name', async () => {
      await mk({ title: 'Основа', venueId: hallId, capacity: 14 })
      await mk({ title: 'Другая' })
      await mk({ title: 'Черновик Основа', status: 'draft' })
      const res = await csv('&q=основа')
      expect(res.status).toBe(200)
      expect(res.headers.get('content-type')).toContain('text/csv')
      expect(res.headers.get('content-disposition')).toMatch(
        /attachment; filename="events-\d{4}-\d{2}-\d{2}\.csv"/,
      )
      expect(res.headers.get('cache-control')).toBe('no-store')
      const rows = lines(res.text)
      expect(rows[0]).toBe('Дата;Название;Зал;Места;Статус')
      // менеджер видит и черновик, как в списке
      expect(rows).toHaveLength(3)
      expect(rows[1]).toMatch(/;Основа;Школа №24;0 из 14;Открыта запись$/)
      expect(rows[2]).toMatch(/;Черновик Основа;;0 из 10;Черновик$/)
    })

    it('neutralises formula injections and keeps player data and money out', async () => {
      for (const title of ['=1+1', '+cmd', '-2', '@SUM(A1)', 'Игра; "тест"']) await mk({ title })
      await mk({ title: 'Оплаченная', price: 987_654 })
      const res = await csv()
      const rows = lines(res.text)
      expect(rows.some((r) => r.includes(";'=1+1;"))).toBe(true)
      expect(rows.some((r) => r.includes(";'+cmd;"))).toBe(true)
      expect(rows.some((r) => r.includes(";'-2;"))).toBe(true)
      expect(rows.some((r) => r.includes(";'@SUM(A1);"))).toBe(true)
      expect(rows.some((r) => r.includes(';"Игра; ""тест""";'))).toBe(true)
      expect(res.text).not.toContain('987654')
      expect(res.text).not.toContain('9876')
      expect(res.text).not.toContain('@t.by')
    })

    it('is manager-only: player 403, anonymous 401, outsider 403', async () => {
      await mk()
      expect((await csv('', playerId)).status).toBe(403)
      expect((await request('GET', `${base()}/export?filter=all`)).status).toBe(401)
      expect((await csv('', outsiderId)).status).toBe(403)
    })

    it('exports only the own group even for a manager of another group', async () => {
      await mk({ title: 'Чужое событие' }, otherOrgId)
      await mk({ title: 'Своё событие' })
      const own = lines((await csv()).text)
      expect(own).toHaveLength(2)
      expect(own[1]).toContain('Своё событие')
      expect((await csv('', ownerId, otherOrgId)).status).toBe(403)
      const foreign = lines((await csv('&q=чужое')).text)
      expect(foreign).toHaveLength(1)
    })

    it('refuses over 5000 rows with 422 and serves exactly 5000', async () => {
      const row = (i: number) => ({
        organizationId: otherOrgId,
        createdByUserId: outsiderId,
        title: `Массовое ${i}`,
        startsAt: new Date(Date.now() + day),
        endsAt: new Date(Date.now() + day + 3_600_000),
        capacity: 4,
        price: 0,
        currency: 'BYN',
      })
      await db.insert(events).values(Array.from({ length: 5000 }, (_, i) => row(i)))
      const atLimit = await csv('', outsiderId, otherOrgId)
      expect(atLimit.status).toBe(200)
      expect(lines(atLimit.text)).toHaveLength(5001)
      await db.insert(events).values(row(5000))
      const over = await csv('', outsiderId, otherOrgId)
      expect(over.status).toBe(422)
      expect((over.body as { data?: { code?: string } }).data?.code).toBe('events.export_too_large')
      const narrowed = await csv('&q=Массовое 1234', outsiderId, otherOrgId)
      expect(narrowed.status).toBe(200)
    })
  })
})
