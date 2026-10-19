import { bookingService, eventService, organizationService } from '@volley-time/core'
import { closeDb, db, eq, events, organizationMembers, organizations, users } from '@volley-time/db'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { createTestApi } from './harness'

/** Task 20.6.1: GET /api/public/events/{slug} — публичная страница события без авторизации (P-17). */
describe('public event API (20.6.1)', () => {
  let request: Awaited<ReturnType<typeof createTestApi>>
  let ownerId: number
  let playerId: number
  let outsiderId: number
  let orgId: number

  const make = async (o: Record<string, unknown> = {}) =>
    eventService.create({ userId: ownerId }, orgId, {
      title: 'Открытая игра',
      startsAt: new Date(Date.now() + 86400000),
      endsAt: new Date(Date.now() + 93600000),
      capacity: 6,
      price: 1500,
      ...o,
    })
  const slugOf = async (id: number) =>
    (await db.select({ s: events.publicSlug }).from(events).where(eq(events.id, id)))[0]!.s
  const get = (slug: string, user?: number) =>
    request('GET', `/api/public/events/${slug}`, user ? { user } : {})

  beforeAll(async () => {
    request = await createTestApi()
  })
  beforeEach(async () => {
    vi.stubEnv('EVENT_SPLIT_PRICING_ENABLED', 'true')
    const tag = crypto.randomUUID()
    const rows = await db
      .insert(users)
      .values(
        ['owner', 'player', 'outsider'].map((n) => ({
          email: `pub-${n}-${tag}@t.by`,
          name: n === 'player' ? 'Мария Секретова' : n,
          telegramUsername: `${n}_${tag.slice(0, 6)}`,
        })),
      )
      .returning()
    ;[ownerId, playerId, outsiderId] = rows.map((r) => r.id) as [number, number, number]
    orgId = (await organizationService.create({ userId: ownerId }, { name: 'Public HTTP' })).id
    await db.insert(organizationMembers).values({
      userId: playerId,
      organizationId: orgId,
      role: 'player',
      status: 'active',
      level: 'v2',
    })
  })
  afterEach(async () => {
    vi.unstubAllEnvs()
    await db.delete(organizations).where(eq(organizations.id, orgId))
    await db.delete(users)
  })
  afterAll(closeDb)

  it('serves a published event without any session, with cache and robots headers', async () => {
    const ev = await make()
    await bookingService.book({ userId: playerId }, orgId, ev.id, { method: 'cash' })
    const res = await get(await slugOf(ev.id))
    expect(res.status, res.text).toBe(200)
    expect(res.headers.get('cache-control')).toMatch(/^public, max-age=\d+/)
    expect(res.headers.get('x-robots-tag')).toContain('noindex')
    expect(res.body).toMatchObject({
      event: { title: 'Открытая игра', capacity: 6, taken: 1, players: 1, full: false },
      group: { name: 'Public HTTP' },
      price: { mode: 'fixed', perSeat: { min: 1500, max: 1500 } },
      roster: { initials: [], more: 0 }, // меньше 3 игроков: только счётчик
      telegramUrl: expect.stringMatching(/^https:\/\/t\.me\/volleytime_test_bot\?start=event_\d+$/),
    })
  })

  it('PRIVACY: no player level, name, username, id, avatar, payment or internal ids in the JSON', async () => {
    const ev = await make()
    await bookingService.book({ userId: playerId }, orgId, ev.id, { method: 'cash' })
    const res = await get(await slugOf(ev.id))
    expect(res.status).toBe(200)
    const text = JSON.stringify(res.body)
    for (const leak of [
      'level',
      'v2',
      'Мария',
      'Секретова',
      'telegramUsername',
      'player_',
      '@t.by',
      '"userId"',
      '"image"',
      'payment',
      'allocatedAmount',
      'inviteToken',
      'organizationId',
      '"id"',
    ])
      expect(text, leak).not.toContain(leak)
    // страница не раскрывает числовые идентификаторы группы и события (кроме параметра бота)
    expect(Object.keys((res.body as { event: object }).event)).not.toContain('id')
  })

  it('answers 404 identically for unknown, malformed and hidden events (no enumeration)', async () => {
    const draft = await make({ status: 'draft' })
    const archived = await make()
    const archivedSlug = await slugOf(archived.id)
    const unknown = await get('0123456789ab')
    const bodies = new Set<string>()
    for (const res of [
      unknown,
      await get(await slugOf(draft.id)),
      await get('short'),
      await get('0123456789AB'),
      await get('..%2f..%2fetc'),
      await get(String(draft.id)),
    ]) {
      expect(res.status).toBe(404)
      expect(res.headers.get('cache-control')).toBe('no-store')
      bodies.add(JSON.stringify({ ...(res.body as object), url: undefined, stack: undefined }))
    }
    expect(bodies.size).toBe(1)
    expect((await get(archivedSlug)).status).toBe(200)
    await db.update(organizations).set({ status: 'archived' }).where(eq(organizations.id, orgId))
    expect((await get(archivedSlug)).status).toBe(404)
  })

  it('the numeric event id is not a public identifier', async () => {
    const ev = await make()
    expect((await get(String(ev.id))).status).toBe(404)
    expect((await get(String(ev.id).padStart(12, '0'))).status).toBe(404)
  })

  it('price equals the member-only price endpoint for the same seat count', async () => {
    const ev = await make({ capacity: 4, priceMode: 'split', price: 0, targetAmount: 10001 })
    await bookingService.book({ userId: playerId }, orgId, ev.id, { method: 'cash' })
    const slug = await slugOf(ev.id)
    const pub = await get(slug)
    const member = await request(
      'GET',
      `/api/organizations/${orgId}/events/${ev.id}/price?seats=1`,
      { user: ownerId }, // владелец без своей брони: места = 1, «моих» мест нет
    )
    expect(member.status).toBe(200)
    expect((pub.body as { price: unknown }).price).toEqual(
      (member.body as { price: unknown }).price,
    )
    expect(pub.body).toMatchObject({ price: { mode: 'split', basis: 'forecast' } })
  })

  it('cancelled event: state is visible, price is hidden', async () => {
    const ev = await make({ capacity: 4, priceMode: 'split', price: 0, targetAmount: 10000 })
    await eventService.cancel({ userId: ownerId }, ev.id)
    const res = await get(await slugOf(ev.id))
    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({
      event: { status: 'cancelled' },
      price: null,
      indexable: false,
    })
  })

  it('reports «full» from occupancy', async () => {
    const ev = await make({ capacity: 1 })
    await bookingService.book({ userId: playerId }, orgId, ev.id, { method: 'cash' })
    expect((await get(await slugOf(ev.id))).body).toMatchObject({
      event: { taken: 1, capacity: 1, full: true },
    })
  })

  it('a stranger or a member sees the same public payload (no per-viewer data)', async () => {
    const ev = await make()
    const slug = await slugOf(ev.id)
    const anon = await get(slug)
    expect((await get(slug, outsiderId)).body).toEqual(anon.body)
    expect((await get(slug, playerId)).body).toEqual(anon.body)
  })
})
