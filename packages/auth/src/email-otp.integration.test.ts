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

  afterAll(async () => {
    await db.delete(users)
    await closeDb()
  })
})
