import { bookingService, eventService, organizationService, memberService } from '@volley-time/core'
import { closeDb, db, eq, organizations, users } from '@volley-time/db'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { createTestApi } from './harness'

/** 20.3.3: внутренние вызовы бота — секрет, авторизация по telegramId, идемпотентность, лимит. */
describe('internal bot API (integration)', () => {
  let request: Awaited<ReturnType<typeof createTestApi>>
  const secret = { 'x-internal-secret': 'dev-internal-secret' }
  let ownerId: number, orgId: number, playerId: number, otherTg: string, playerTg: string

  beforeAll(async () => {
    request = await createTestApi()
  })
  afterAll(async () => {
    await db.delete(organizations)
    await db.delete(users)
    await closeDb()
  })
  beforeEach(async () => {
    await db.delete(organizations)
    await db.delete(users)
    const mk = async (name: string, tg: bigint) =>
      (
        await db
          .insert(users)
          .values({ email: `${name}-${Math.random()}@t.by`, name, telegramUserId: tg })
          .returning()
      )[0]!.id
    ownerId = await mk('owner', BigInt(7000001))
    playerId = await mk('player', BigInt(7000002))
    await mk('other', BigInt(7000003))
    playerTg = '7000002'
    otherTg = '7000003'
    orgId = (await organizationService.create({ userId: ownerId }, { name: 'Bot Org' })).id
    await memberService.add({ userId: ownerId }, { organizationId: orgId, userId: playerId })
  })

  const post = (path: string, body: unknown, headers: Record<string, string> = secret) =>
    request('POST', `/api/internal/bot/${path}`, { body, headers })

  it('every route requires the shared secret (401 without or with a wrong one)', async () => {
    for (const [m, p, body] of [
      ['GET', `games?telegramId=${playerTg}`, undefined],
      ['GET', `my?telegramId=${playerTg}`, undefined],
      ['POST', 'reachable', { telegramId: playerTg }],
      ['POST', 'cancel-booking', { telegramId: playerTg, eventId: 1 }],
      ['POST', 'accept-offer', { telegramId: playerTg, eventId: 1 }],
    ] as const) {
      expect((await request(m, `/api/internal/bot/${p}`, { body })).status, p).toBe(401)
      expect(
        (
          await request(m, `/api/internal/bot/${p}`, {
            body,
            headers: { 'x-internal-secret': 'nope' },
          })
        ).status,
        p,
      ).toBe(401)
    }
  })

  it('rejects malformed payloads with 422', async () => {
    expect((await post('reachable', { telegramId: 'abc' })).status).toBe(422)
    expect(
      (await post('cancel-booking', { telegramId: playerTg, eventId: '1; drop' })).status,
    ).toBe(422)
    expect((await post('cancel-booking', { telegramId: playerTg, eventId: -3 })).status).toBe(422)
  })

  it('reachable clears bot_blocked_at', async () => {
    await db.update(users).set({ botBlockedAt: new Date() }).where(eq(users.id, playerId))
    const res = await post('reachable', { telegramId: playerTg })
    expect(res.status).toBe(200)
    const [u] = await db.select().from(users).where(eq(users.id, playerId))
    expect(u!.botBlockedAt).toBeNull()
  })

  it('games / my / cancel round-trip is scoped to the caller', async () => {
    const ev = await eventService.create({ userId: ownerId }, orgId, {
      title: 'Основа',
      startsAt: new Date(Date.now() + 86400_000),
      endsAt: new Date(Date.now() + 93600_000),
      capacity: 4,
      price: 0,
    })
    await bookingService.book({ userId: playerId }, orgId, ev.id, { method: 'free' })
    const games = await request('GET', `/api/internal/bot/games?telegramId=${playerTg}`, {
      headers: secret,
    })
    expect((games.body as { games: unknown[] }).games).toHaveLength(1)
    const stranger = await request('GET', `/api/internal/bot/games?telegramId=${otherTg}`, {
      headers: secret,
    })
    expect((stranger.body as { games: unknown[] }).games).toHaveLength(0)
    const mine = await request('GET', `/api/internal/bot/my?telegramId=${playerTg}`, {
      headers: secret,
    })
    expect((mine.body as { bookings: unknown[] }).bookings).toHaveLength(1)

    expect((await post('cancel-booking', { telegramId: otherTg, eventId: ev.id })).body).toEqual({
      result: 'not_found',
    })
    expect((await post('cancel-booking', { telegramId: playerTg, eventId: ev.id })).body).toEqual({
      result: 'cancelled',
    })
    expect((await post('cancel-booking', { telegramId: playerTg, eventId: ev.id })).body).toEqual({
      result: 'already_cancelled',
    })
  })

  it('rate limits a single telegram user (429 with retry-after)', async () => {
    let last = 0
    for (let i = 0; i < 40; i++) last = (await post('reachable', { telegramId: '7000009' })).status
    expect(last).toBe(429)
  })
})
