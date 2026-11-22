import { closeDb, db, users } from '@volley-time/db'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { createTestApi } from './harness'

/**
 * Task 23.1.1 (P-12): HTTP-контракт `GET/PATCH /api/me/features`. Флаги принадлежат пользователю:
 * нет сессии — 401, чужие флаги недоступны, неизвестные ключи (расписание, запись, оплата) — 422.
 */
describe('me features API (HTTP integration)', () => {
  let request: Awaited<ReturnType<typeof createTestApi>>
  let me: number
  let other: number

  const newUser = async (tag: string) =>
    (
      await db
        .insert(users)
        .values({ email: `mf-${tag}-${Math.random()}@t.by` })
        .returning()
    )[0]!.id

  beforeAll(async () => {
    request = await createTestApi()
  })

  beforeEach(async () => {
    await db.delete(users)
    me = await newUser('me')
    other = await newUser('other')
  })

  afterAll(async () => {
    await db.delete(users)
    await closeDb()
  })

  it('requires a session', async () => {
    expect((await request('GET', '/api/me/features')).status).toBe(401)
    expect((await request('PATCH', '/api/me/features', { body: { cal: false } })).status).toBe(401)
  })

  it('returns eight flags, all on by default', async () => {
    const res = await request('GET', '/api/me/features', { user: me })
    expect(res.status).toBe(200)
    const { features } = res.body as { features: Record<string, boolean> }
    expect(Object.keys(features)).toEqual([
      'cal',
      'coach',
      'warmup',
      'self',
      'mvp',
      'teams',
      'streak',
      'wrapped',
    ])
    expect(Object.values(features).every((v) => v === true)).toBe(true)
  })

  it('persists a PATCH across requests for the same user only', async () => {
    const patch = await request('PATCH', '/api/me/features', { user: me, body: { cal: false } })
    expect(patch.status).toBe(200)
    expect(patch.body).toMatchObject({ features: { cal: false, mvp: true } })
    const again = await request('GET', '/api/me/features', { user: me })
    expect(again.body).toMatchObject({ features: { cal: false } })
    const others = await request('GET', '/api/me/features', { user: other })
    expect(others.body).toMatchObject({ features: { cal: true } })
    const on = await request('PATCH', '/api/me/features', { user: me, body: { cal: true } })
    expect(on.body).toMatchObject({ features: { cal: true } })
  })

  it('rejects unknown flags and wrong types with 422', async () => {
    for (const body of [{ schedule: false }, { booking: false }, { payment: false }, { cal: 0 }]) {
      const res = await request('PATCH', '/api/me/features', { user: me, body })
      expect(res.status).toBe(422)
    }
    const res = await request('GET', '/api/me/features', { user: me })
    expect(
      Object.values((res.body as { features: Record<string, boolean> }).features),
    ).not.toContain(false)
  })
})
