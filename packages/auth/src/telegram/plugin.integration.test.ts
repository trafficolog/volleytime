import { createHmac } from 'node:crypto'

import { closeDb, db, users } from '@volley-time/db'
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest'

import { auth } from '../config'
import { sentEmails } from '../email'

const BOT_TOKEN = '123456:PLUGIN_TEST'

function signInitData(tgId: number, token = BOT_TOKEN): string {
  const params: Record<string, string> = {
    user: JSON.stringify({ id: tgId, first_name: 'Игрок', username: `p${tgId}` }),
    auth_date: String(Math.floor(Date.now() / 1000)),
  }
  const dcs = Object.entries(params)
    .map(([k, v]) => `${k}=${v}`)
    .sort()
    .join('\n')
  const secret = createHmac('sha256', 'WebAppData').update(token).digest()
  const sp = new URLSearchParams(params)
  sp.set('hash', createHmac('sha256', secret).update(dcs).digest('hex'))
  return sp.toString()
}

function post(path: string, body: unknown, cookie?: string) {
  return auth.handler(
    new Request(`http://localhost:3000/api/auth${path}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        origin: 'http://localhost:3000',
        ...(cookie ? { cookie } : {}),
      },
      body: JSON.stringify(body),
    }),
  )
}

async function signInByEmail(email: string): Promise<string> {
  process.env.EMAIL_DRIVER = 'memory'
  await post('/email-otp/send-verification-otp', { email, type: 'sign-in' })
  const otp = sentEmails
    .filter((m) => m.to === email)
    .at(-1)
    ?.text.match(/(\d{6})/)?.[1]
  const res = await post('/sign-in/email-otp', { email, otp })
  return cookieOf(res)
}

const cookieOf = (res: Response) =>
  res.headers
    .getSetCookie()
    .map((c) => c.split(';')[0])
    .join('; ')

describe('telegramPlugin — single better-auth session (integration, 3.9.4)', () => {
  const orig = process.env.TELEGRAM_BOT_TOKEN
  beforeEach(async () => {
    process.env.TELEGRAM_BOT_TOKEN = BOT_TOKEN
    await db.delete(users)
  })
  afterEach(() => {
    process.env.TELEGRAM_BOT_TOKEN = orig
  })

  it('valid initData → better-auth session visible via get-session', async () => {
    const res = await post('/sign-in/telegram', { initData: signInitData(7001) })
    expect(res.status).toBe(200)
    const body = (await res.json()) as { userId: number; isNewUser: boolean }
    expect(body.isNewUser).toBe(true)
    const session = await auth.api.getSession({ headers: new Headers({ cookie: cookieOf(res) }) })
    expect(Number(session?.user.id)).toBe(body.userId)
  })

  it('errors are in Russian (3.10.3)', async () => {
    const res = await post('/sign-in/telegram', { initData: signInitData(7050, 'WRONG:TOKEN') })
    const body = (await res.json()) as { message?: string }
    expect(res.status).toBe(401)
    expect(body.message).toMatch(/[а-яё]/i)
  })

  it('SECURITY: initData signed with empty token → 401, no session', async () => {
    const res = await post('/sign-in/telegram', { initData: signInitData(7002, '') })
    expect(res.status).toBe(401)
    expect(cookieOf(res)).not.toContain('session_token')
  })

  it('SECURITY: bot token not configured → 500, never 200', async () => {
    process.env.TELEGRAM_BOT_TOKEN = ''
    const res = await post('/sign-in/telegram', { initData: signInitData(7003, '') })
    expect(res.status).toBe(500)
  })

  it('link/telegram: 401 without session, 200 for email user, 409 on conflict (3.9.8)', async () => {
    const anon = await post('/link/telegram', { initData: signInitData(7101) })
    expect(anon.status).toBe(401)

    const cookieA = await signInByEmail('link-a@test.by')
    const ok = await post('/link/telegram', { initData: signInitData(7101) }, cookieA)
    expect(ok.status).toBe(200)

    const again = await post('/link/telegram', { initData: signInitData(7101) }, cookieA)
    expect(again.status).toBe(409)

    const cookieB = await signInByEmail('link-b@test.by')
    const conflict = await post('/link/telegram', { initData: signInitData(7101) }, cookieB)
    expect(conflict.status).toBe(409)
    const body = (await conflict.json()) as { code?: string }
    expect(String(body.code).toLowerCase()).toContain('linked_to_other_user')
  })

  afterAll(async () => {
    await db.delete(users)
    await closeDb()
  })
})
