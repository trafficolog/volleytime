import { createHmac } from 'node:crypto'

import { auth } from '@volley-time/auth'
import { organizationService } from '@volley-time/core'
import { closeDb, db, eq, organizations, sessions, users } from '@volley-time/db'
import { grantPlatformRole } from '@volley-time/db/test-utils'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { createTestApi } from './harness'

/**
 * Решение владельца 2026-11-19: «re-enable on each deploy». Уборка smoke (9.10.4) больше не
 * блокирует аккаунт, а шаг prepare перед входом включает его обратно, но только настоящий
 * технический аккаунт: не root, без членств в группах, с именем после уборки.
 */
const TG_ID = 900000042n
const BOT_TOKEN = '123456:SMOKE_PREPARE_TEST'
const secret = { 'x-internal-secret': 'dev-internal-secret' }

function signInitData(tgId: bigint): string {
  const params: Record<string, string> = {
    user: JSON.stringify({ id: Number(tgId), first_name: 'Smoke', username: 'smoke_bot_user' }),
    auth_date: String(Math.floor(Date.now() / 1000)),
  }
  const dcs = Object.entries(params)
    .map(([k, v]) => `${k}=${v}`)
    .sort()
    .join('\n')
  const key = createHmac('sha256', 'WebAppData').update(BOT_TOKEN).digest()
  const sp = new URLSearchParams(params)
  sp.set('hash', createHmac('sha256', key).update(dcs).digest('hex'))
  return sp.toString()
}

const signIn = () =>
  auth.handler(
    new Request('http://localhost:3000/api/auth/sign-in/telegram', {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: 'http://localhost:3000' },
      body: JSON.stringify({ initData: signInitData(TG_ID) }),
    }),
  )

describe('smoke cleanup / prepare (integration)', { timeout: 30_000 }, () => {
  let request: Awaited<ReturnType<typeof createTestApi>>
  const origToken = process.env.TELEGRAM_BOT_TOKEN

  beforeAll(async () => {
    process.env.TELEGRAM_BOT_TOKEN = BOT_TOKEN
    request = await createTestApi()
  })
  beforeEach(async () => {
    await db.delete(organizations)
    await db.delete(users)
  })
  afterAll(async () => {
    if (origToken === undefined) delete process.env.TELEGRAM_BOT_TOKEN
    else process.env.TELEGRAM_BOT_TOKEN = origToken
    await db.delete(organizations)
    await db.delete(users)
    await closeDb()
  })

  const flag = async (id: number) =>
    (await db.select({ a: users.isActive }).from(users).where(eq(users.id, id)))[0]!.a
  const smokeUser = async (v: Partial<typeof users.$inferInsert> = {}) =>
    (
      await db
        .insert(users)
        .values({ telegramUserId: TG_ID, name: 'Smoke check', isActive: false, ...v })
        .returning()
    )[0]!
  const prepare = (headers: Record<string, string> = secret, tg: unknown = String(TG_ID)) =>
    request('POST', '/api/internal/smoke/prepare', { headers, body: { telegramUserId: tg } })
  const cleanup = () =>
    request('POST', '/api/internal/smoke/cleanup', {
      headers: secret,
      body: { telegramUserId: String(TG_ID) },
    })

  it('requires the internal secret', async () => {
    const u = await smokeUser()
    for (const headers of [{}, { 'x-internal-secret': 'nope' }]) {
      expect((await prepare(headers)).status).toBe(401)
    }
    expect(await flag(u.id)).toBe(false)
  })

  it('re-enables the smoke account (inactive, named «Smoke check», no memberships)', async () => {
    const u = await smokeUser()
    const r = await prepare()
    expect(r.status).toBe(200)
    expect(r.body).toEqual({ prepared: true, reason: 'reenabled', userId: u.id })
    expect(await flag(u.id)).toBe(true)
  })

  it('is a no-op for an already active smoke account and for a missing one', async () => {
    const u = await smokeUser({ isActive: true })
    expect((await prepare()).body).toMatchObject({ prepared: true, reason: 'already_active' })
    expect(await flag(u.id)).toBe(true)
    await db.delete(users)
    expect((await prepare()).body).toEqual({ prepared: true, reason: 'user_not_found' })
  })

  it('refuses a blocked user that is not the smoke account (other name)', async () => {
    const u = await smokeUser({ name: 'Иван Иванов' })
    const r = await prepare()
    expect(r.status).toBe(200)
    expect(r.body).toEqual({ prepared: false, reason: 'not_smoke_account' })
    expect(await flag(u.id)).toBe(false)
  })

  it('never re-enables a root admin, even one named «Smoke check»', async () => {
    const u = await smokeUser()
    await grantPlatformRole(u.id, 'support')
    expect((await prepare()).body).toEqual({ prepared: false, reason: 'not_smoke_account' })
    expect(await flag(u.id)).toBe(false)
  })

  it('never re-enables a user with organization memberships, even named «Smoke check»', async () => {
    const u = await smokeUser()
    await organizationService.create({ userId: u.id }, { name: 'Real org' })
    expect((await prepare()).body).toEqual({ prepared: false, reason: 'not_smoke_account' })
    expect(await flag(u.id)).toBe(false)
  })

  it('rejects a malformed telegram id', async () => {
    expect((await prepare(secret, 'abc')).status).toBe(422)
  })

  it('cleanup no longer deactivates the account but renames it and drops sessions', async () => {
    expect((await signIn()).status).toBe(200) // создаёт аккаунт, как первый smoke на пустой базе
    const [u] = await db.select().from(users).where(eq(users.telegramUserId, TG_ID))
    expect(await db.$count(sessions, eq(sessions.userId, u!.id))).toBeGreaterThan(0)

    expect((await cleanup()).body).toMatchObject({ cleaned: true, userId: u!.id })
    const [after] = await db.select().from(users).where(eq(users.id, u!.id))
    expect(after).toMatchObject({ name: 'Smoke check', isActive: true })
    expect(await db.$count(sessions, eq(sessions.userId, u!.id))).toBe(0)
  })

  it('cleanup → prepare → sign in again succeeds; a stale inactive flag (prod user #4) is healed', async () => {
    expect((await signIn()).status).toBe(200)
    await cleanup()
    // состояние боевой базы до этого PR: старая уборка оставила is_active = false
    await db.update(users).set({ isActive: false }).where(eq(users.telegramUserId, TG_ID))
    expect((await signIn()).status).toBe(403)

    expect((await prepare()).body).toMatchObject({ prepared: true, reason: 'reenabled' })
    expect((await signIn()).status).toBe(200)

    // следующий деплой: уборка не блокирует, повторный вход проходит и без prepare
    await cleanup()
    expect((await signIn()).status).toBe(200)
  })
})
