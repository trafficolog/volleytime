import { memberService, organizationService } from '@volley-time/core'
import { closeDb, db, organizations, sql, users } from '@volley-time/db'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { createTestApi } from './harness'

/**
 * 21.2.4: сквозной сценарий сборов через API — организатор создаёт сбор, игрок вносит взнос,
 * организатор подтверждает и отклоняет; сумма подтверждённых взносов = поступления кассы по сбору.
 * Права по матрице — в IDOR-таблице; здесь коды ошибок, флаг и видимость для игрока.
 */
describe('collections API (21.2.4)', () => {
  let request: Awaited<ReturnType<typeof createTestApi>>
  let ownerId: number, organizerId: number, playerId: number, player2Id: number
  let orgId: number

  const mk = async (name: string) =>
    (
      await db
        .insert(users)
        .values({ email: `${name}-${Math.random()}@t.by`, name })
        .returning()
    )[0]!.id
  const base = () => `/api/organizations/${orgId}/collections`
  const code = (res: { body: unknown }) => (res.body as { data?: { code?: string } }).data?.code

  beforeAll(async () => {
    request = await createTestApi()
  })

  beforeEach(async () => {
    vi.stubEnv('COLLECTIONS_ENABLED', 'true')
    await db.delete(organizations)
    await db.delete(users)
    ownerId = await mk('owner')
    organizerId = await mk('organizer')
    playerId = await mk('player')
    player2Id = await mk('player2')
    orgId = (await organizationService.create({ userId: ownerId }, { name: 'Сборы API' })).id
    const add = (userId: number, role?: 'organizer') =>
      memberService.add({ userId: ownerId }, { organizationId: orgId, userId, role })
    await add(organizerId, 'organizer')
    await add(playerId)
    await add(player2Id)
  })

  afterAll(async () => {
    vi.unstubAllEnvs()
    await db.delete(organizations)
    await db.delete(users)
    await closeDb()
  })

  it('pledge → confirm: confirmed contributions equal the cash income of the collection', async () => {
    const created = await request('POST', base(), {
      user: organizerId,
      body: { title: 'Новый комплект мячей', targetAmount: 25000, icon: 'ball' },
    })
    expect(created.status, created.text).toBe(200)
    const id = (created.body as { collection: { id: number } }).collection.id

    const pledge = (user: number, amount: number) =>
      request('POST', `${base()}/${id}/contributions`, { user, body: { amount, method: 'cash' } })
    const p1 = await pledge(playerId, 1500)
    expect(p1.status, p1.text).toBe(200)
    const p2 = await pledge(player2Id, 2000)
    const c1 = (p1.body as { contribution: { id: number } }).contribution.id
    const c2 = (p2.body as { contribution: { id: number } }).contribution.id

    // игрок не подтверждает взносы
    expect(
      (await request('POST', `${base()}/${id}/contributions/${c1}/confirm`, { user: playerId }))
        .status,
    ).toBe(403)
    const ok = await request('POST', `${base()}/${id}/contributions/${c1}/confirm`, {
      user: organizerId,
    })
    expect(ok.status, ok.text).toBe(200)
    const again = await request('POST', `${base()}/${id}/contributions/${c1}/confirm`, {
      user: organizerId,
    })
    expect(again.status).toBe(409)
    expect(code(again)).toBe('payment.not_pending')
    const rejected = await request('POST', `${base()}/${id}/contributions/${c2}/reject`, {
      user: ownerId,
    })
    expect(rejected.status, rejected.text).toBe(200)

    const view = await request('GET', `${base()}/${id}`, { user: playerId })
    expect(view.status).toBe(200)
    const { collection, contributions } = view.body as {
      collection: { collected: number; pledged: number; contributors: number }
      contributions: { amount: number; status: string; user: Record<string, unknown> }[]
    }
    expect(collection).toMatchObject({ collected: 1500, pledged: 0, contributors: 1 })
    expect(contributions).toHaveLength(1)
    expect(Object.keys(contributions[0]!.user).sort()).toEqual([
      'id',
      'image',
      'name',
      'telegramUsername',
    ])

    const [cash] = await db.execute<{ income: number }>(sql`
      SELECT coalesce(sum(l.amount), 0)::int AS income FROM ledger_entries l
      JOIN payments p ON p.id = l.payment_id
      WHERE p.collection_id = ${id} AND l.type = 'income' AND l.category = 'contribution'`)
    expect(cash!.income).toBe(collection.collected)

    // в кассе группы взнос виден как contribution
    const ledger = await request('GET', `/api/organizations/${orgId}/ledger`, { user: ownerId })
    const entries = (ledger.body as { entries: { category: string; amount: number }[] }).entries
    expect(entries.filter((e) => e.category === 'contribution')).toEqual([
      expect.objectContaining({ amount: 1500 }),
    ])
  })

  it('maps domain errors: draft is invisible to players, closed collection, disabled flag', async () => {
    const draft = await request('POST', base(), {
      user: ownerId,
      body: { title: 'Черновик', status: 'draft' },
    })
    const id = (draft.body as { collection: { id: number } }).collection.id
    const hidden = await request('GET', `${base()}/${id}`, { user: playerId })
    expect(hidden.status).toBe(404)
    expect(code(hidden)).toBe('collection.not_found')
    const list = await request('GET', base(), { user: playerId })
    expect((list.body as { collections: unknown[] }).collections).toHaveLength(0)
    expect(
      ((await request('GET', base(), { user: ownerId })).body as { collections: unknown[] })
        .collections,
    ).toHaveLength(1)

    await request('PATCH', `${base()}/${id}`, { user: ownerId, body: { status: 'active' } })
    const done = await request('POST', `${base()}/${id}/complete`, { user: ownerId })
    expect(done.status).toBe(200)
    const late = await request('POST', `${base()}/${id}/contributions`, {
      user: playerId,
      body: { amount: 100, method: 'cash' },
    })
    expect(late.status).toBe(409)
    expect(code(late)).toBe('collection.not_active')

    const invalid = await request('POST', base(), {
      user: ownerId,
      body: { title: 'X', targetAmount: 0 },
    })
    expect(invalid.status).toBe(422)

    vi.stubEnv('COLLECTIONS_ENABLED', 'false')
    const off = await request('POST', base(), { user: ownerId, body: { title: 'Мячи' } })
    expect(off.status).toBe(409)
    expect(code(off)).toBe('collection.disabled')
    const org = await request('GET', `/api/organizations/${orgId}`, { user: playerId })
    expect((org.body as { capabilities: { collections: boolean } }).capabilities.collections).toBe(
      false,
    )
  })

  it('pages the list with an opaque keyset cursor', async () => {
    for (const title of ['A', 'B', 'C'])
      await request('POST', base(), { user: ownerId, body: { title } })
    const first = await request('GET', `${base()}?limit=2`, { user: playerId })
    const page1 = first.body as { collections: { title: string }[]; nextCursor: string | null }
    expect(page1.collections.map((c) => c.title)).toEqual(['C', 'B'])
    const second = await request(
      'GET',
      `${base()}?limit=2&cursor=${encodeURIComponent(page1.nextCursor!)}`,
      { user: playerId },
    )
    const page2 = second.body as { collections: { title: string }[]; nextCursor: string | null }
    expect(page2.collections.map((c) => c.title)).toEqual(['A'])
    expect(page2.nextCursor).toBeNull()
    expect((await request('GET', `${base()}?cursor=bogus!`, { user: playerId })).status).toBe(422)
  })
})
