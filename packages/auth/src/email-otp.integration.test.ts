import { closeDb, db, eq, users, verifications } from '@volley-time/db'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'

import { auth } from './config'
import { sentEmails } from './email'

/** Полный цикл email-OTP через HTTP-обработчик better-auth (Task 3.9.3, review 3 P0#2). */
const BASE = 'http://localhost:3000/api/auth'

async function call(path: string, body?: unknown, cookie?: string) {
  const res = await auth.handler(
    new Request(`${BASE}${path}`, {
      method: body ? 'POST' : 'GET',
      headers: {
        'content-type': 'application/json',
        origin: 'http://localhost:3000',
        ...(cookie ? { cookie } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    }),
  )
  return res
}

describe('email-OTP sign-in (integration)', () => {
  beforeEach(async () => {
    process.env.EMAIL_DRIVER = 'memory'
    sentEmails.length = 0
    await db.delete(users)
    await db.delete(verifications)
  })

  it('send → sign-in → get-session with numeric user id', async () => {
    const email = `otp-${Date.now()}@test.by`
    const send = await call('/email-otp/send-verification-otp', { email, type: 'sign-in' })
    expect(send.status).toBe(200)

    const letter = sentEmails.find((m) => m.to === email)
    const otp = letter?.text.match(/(\d{6})/)?.[1]
    expect(otp).toBeDefined()

    // OTP хранится хешем
    const rows = await db.select().from(verifications)
    expect(rows.length).toBe(1)
    expect(rows[0]!.value).not.toContain(otp!)

    const signIn = await call('/sign-in/email-otp', { email, otp })
    expect(signIn.status).toBe(200)
    const cookie = signIn.headers
      .getSetCookie()
      .map((c) => c.split(';')[0])
      .join('; ')
    expect(cookie).toContain('session_token')

    const session = await call('/get-session', undefined, cookie)
    expect(session.status).toBe(200)
    const data = (await session.json()) as { user: { id: number | string; email: string } }
    expect(data.user.email).toBe(email)
    expect(Number(data.user.id)).toBeGreaterThan(0)

    const dbUser = await db.query.users.findFirst({ where: eq(users.email, email) })
    expect(dbUser?.emailVerified).toBe(true)
  })

  it('wrong OTP → not 200', async () => {
    const email = `otp-bad-${Date.now()}@test.by`
    await call('/email-otp/send-verification-otp', { email, type: 'sign-in' })
    const signIn = await call('/sign-in/email-otp', { email, otp: '000000' })
    expect(signIn.status).not.toBe(200)
  })

  async function sendAndGetOtp(email: string) {
    const send = await call('/email-otp/send-verification-otp', { email, type: 'sign-in' })
    expect(send.status).toBe(200)
    const otp = sentEmails.find((m) => m.to === email)?.text.match(/(\d{6})/)?.[1]
    expect(otp).toBeDefined()
    return otp!
  }
  const wrongOf = (otp: string) => (otp === '000000' ? '111111' : '000000')

  it('allowedAttempts 3: after 3 wrong codes the 4th attempt is rejected even with the right code', async () => {
    const email = `otp-limit-${Date.now()}@test.by`
    const otp = await sendAndGetOtp(email)
    for (let i = 0; i < 3; i++) {
      const res = await call('/sign-in/email-otp', { email, otp: wrongOf(otp) })
      expect(res.status).not.toBe(200)
    }
    const fourth = await call('/sign-in/email-otp', { email, otp })
    expect(fourth.status).not.toBe(200)
    expect(fourth.headers.getSetCookie().join(';')).not.toContain('session_token')
  })

  /**
   * better-auth атомарно забирает запись кода на время сравнения: параллельный запрос,
   * пришедший в это окно, получает INVALID_OTP без сравнения и без списания попытки.
   * Поэтому всплеск из 6 неверных кодов списывает от 1 до 3 попыток в зависимости от
   * чередования (Deploy 44758244634: списана 1, верный код затем вошёл — это не лишняя
   * попытка). Инвариант безопасности: всего сравнённых кодов не больше 3. Проверяем его
   * при любом чередовании: списано не больше 3 и остаток бюджета ровно `3 - списано`.
   */
  it('allowedAttempts 3: concurrent wrong codes do not grant extra guesses', async () => {
    const email = `otp-race-${Date.now()}@test.by`
    const otp = await sendAndGetOtp(email)
    const results = await Promise.all(
      Array.from({ length: 6 }, () => call('/sign-in/email-otp', { email, otp: wrongOf(otp) })),
    )
    for (const res of results) expect(res.status).not.toBe(200)

    // Значение хранится как `<hash>:<попыток>`; без суффикса — попыток 0, без записи — сгорел.
    const rows = await db.select().from(verifications)
    const stored = rows[0]?.value
    const suffix = stored?.includes(':') ? stored.slice(stored.lastIndexOf(':') + 1) : '0'
    const used = stored === undefined ? 3 : Number(suffix)
    expect(used).toBeGreaterThanOrEqual(0)
    expect(used).toBeLessThanOrEqual(3)

    // Остаток бюджета расходуется неверными кодами по одному; после него верный код отклоняется.
    for (let i = used; i < 3; i++) {
      const res = await call('/sign-in/email-otp', { email, otp: wrongOf(otp) })
      expect(res.status).not.toBe(200)
    }
    const after = await call('/sign-in/email-otp', { email, otp })
    expect(after.status).not.toBe(200)
    expect(after.headers.getSetCookie().join(';')).not.toContain('session_token')
  })

  it('session cookie attributes (27.2.6 cookie check)', async () => {
    const email = `otp-cookie-${Date.now()}@test.by`
    const otp = await sendAndGetOtp(email)
    const res = await call('/sign-in/email-otp', { email, otp })
    expect(res.status).toBe(200)
    const token = res.headers.getSetCookie().find((c) => c.includes('session_token='))
    expect(token).toBeDefined()
    expect(token).toMatch(/HttpOnly/i)
    expect(token).toMatch(/SameSite=Lax/i)
    expect(token).not.toMatch(/Partitioned/i)
  })

  afterAll(async () => {
    await db.delete(users)
    await closeDb()
  })
})
