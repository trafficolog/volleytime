import { createHmac } from 'node:crypto'

import { closeDb, db, eq, sessions, users } from '@volley-time/db'
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest'

import { auth } from './config'
import { sentEmails } from './email'

/**
 * Task 22.1.4: пользователь с `users.is_active = false` (платформенная блокировка root) не может
 * получить новую сессию ни одним способом входа. Закрытие уже выданных сессий делает
 * `platformUsersService.block`, проверка каждого запроса — `requireAuth` (apps/web).
 */
const BOT_TOKEN = '123456:BLOCKED_TEST'
const BASE = 'http://localhost:3000/api/auth'

function signInitData(tgId: number): string {
  const params: Record<string, string> = {
    user: JSON.stringify({ id: tgId, first_name: 'Игрок', username: `p${tgId}` }),
    auth_date: String(Math.floor(Date.now() / 1000)),
  }
  const dcs = Object.entries(params)
    .map(([k, v]) => `${k}=${v}`)
    .sort()
    .join('\n')
  const secret = createHmac('sha256', 'WebAppData').update(BOT_TOKEN).digest()
  const sp = new URLSearchParams(params)
  sp.set('hash', createHmac('sha256', secret).update(dcs).digest('hex'))
  return sp.toString()
}

const post = (path: string, body: unknown) =>
  auth.handler(
    new Request(`${BASE}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: 'http://localhost:3000' },
      body: JSON.stringify(body),
    }),
  )

const cookieOf = (res: Response) =>
  res.headers
    .getSetCookie()
    .map((c) => c.split(';')[0])
    .join('; ')

async function emailSignIn(email: string) {
  await post('/email-otp/send-verification-otp', { email, type: 'sign-in' })
  const otp = sentEmails
    .filter((m) => m.to === email)
    .at(-1)
    ?.text.match(/(\d{6})/)?.[1]
  return post('/sign-in/email-otp', { email, otp })
}

describe('blocked user cannot sign in (integration)', { timeout: 30_000 }, () => {
  const origToken = process.env.TELEGRAM_BOT_TOKEN
  const origDriver = process.env.EMAIL_DRIVER
  beforeEach(async () => {
    process.env.TELEGRAM_BOT_TOKEN = BOT_TOKEN
    process.env.EMAIL_DRIVER = 'memory'
    sentEmails.length = 0
    await db.delete(users)
  })
  afterEach(() => {
    if (origToken === undefined) delete process.env.TELEGRAM_BOT_TOKEN
    else process.env.TELEGRAM_BOT_TOKEN = origToken
    if (origDriver === undefined) delete process.env.EMAIL_DRIVER
    else process.env.EMAIL_DRIVER = origDriver
  })
  afterAll(async () => {
    await db.delete(users)
    await closeDb()
  })

  it('email-OTP: 403 and no session for a blocked user, works again after unblocking', async () => {
    const email = 'blocked-otp@test.by'
    const [user] = await db
      .insert(users)
      .values({ email, emailVerified: true, name: 'Blocked', isActive: false })
      .returning()

    const res = await emailSignIn(email)
    expect(res.status).toBe(403)
    expect(cookieOf(res)).not.toContain('session_token')
    expect(await db.$count(sessions, eq(sessions.userId, user!.id))).toBe(0)

    await db.update(users).set({ isActive: true }).where(eq(users.id, user!.id))
    const again = await emailSignIn(email)
    expect(again.status).toBe(200)
    expect(cookieOf(again)).toContain('session_token')
  })

  it('Telegram Mini App: 403 and no session for a blocked user', async () => {
    const [user] = await db
      .insert(users)
      .values({
        telegramUserId: 8101n,
        telegramUsername: 'p8101',
        name: 'Blocked',
        isActive: false,
      })
      .returning()

    const res = await post('/sign-in/telegram', { initData: signInitData(8101) })
    expect(res.status).toBe(403)
    expect(cookieOf(res)).not.toContain('session_token')
    expect(await db.$count(sessions, eq(sessions.userId, user!.id))).toBe(0)

    await db.update(users).set({ isActive: true }).where(eq(users.id, user!.id))
    const again = await post('/sign-in/telegram', { initData: signInitData(8101) })
    expect(again.status).toBe(200)
  })
})
