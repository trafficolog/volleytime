import { createHash, createHmac } from 'node:crypto'

import { auth } from '@volley-time/auth'
import { closeDb, db, users } from '@volley-time/db'
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest'

import { TELEGRAM_WIDGET_ENDPOINT, signInWithTelegramWidget } from '../../app/utils/telegram-widget'
import { loginOptionsFromEnv } from '../utils/login-options'

/**
 * Путь JS-callback экрана входа (20.5.1, D-05): ровно та функция, которую вызывает страница,
 * отправляет данные виджета в настоящий обработчик better-auth. Токен бота тестовый.
 */
const BOT_TOKEN = '123456:LOGIN_WIDGET_FLOW_TEST'

function signWidget(tgId: number, ageSeconds = 0) {
  const fields: Record<string, string | number> = {
    id: tgId,
    first_name: 'Игрок',
    username: `w${tgId}`,
    auth_date: Math.floor(Date.now() / 1000) - ageSeconds,
  }
  const dcs = Object.keys(fields)
    .sort()
    .map((k) => `${k}=${fields[k]}`)
    .join('\n')
  const secret = createHash('sha256').update(BOT_TOKEN).digest()
  return { ...fields, hash: createHmac('sha256', secret).update(dcs).digest('hex') }
}

let lastResponse: Response | undefined
async function post(body: Record<string, unknown>) {
  lastResponse = await auth.handler(
    new Request(`http://localhost:3000${TELEGRAM_WIDGET_ENDPOINT}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: 'http://localhost:3000' },
      body: JSON.stringify(body),
    }),
  )
  if (!lastResponse.ok) throw new Error(`HTTP ${lastResponse.status}`)
  return lastResponse.json()
}

const cookie = () =>
  (lastResponse?.headers.getSetCookie() ?? []).map((c) => c.split(';')[0]).join('; ')

describe('login screen widget callback → better-auth session (integration, 20.5.1)', () => {
  const origToken = process.env.TELEGRAM_BOT_TOKEN
  const origFlag = process.env.TELEGRAM_LOGIN_WIDGET_ENABLED
  beforeEach(async () => {
    process.env.TELEGRAM_BOT_TOKEN = BOT_TOKEN
    process.env.TELEGRAM_LOGIN_WIDGET_ENABLED = 'true'
    lastResponse = undefined
    await db.delete(users)
  })
  afterEach(() => {
    for (const [key, value] of [
      ['TELEGRAM_BOT_TOKEN', origToken],
      ['TELEGRAM_LOGIN_WIDGET_ENABLED', origFlag],
    ] as const) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
  })
  afterAll(async () => {
    await closeDb()
  })

  it('a valid test-signed payload creates a session when the flag is on', async () => {
    expect(loginOptionsFromEnv(process.env).telegramWidget).toEqual({ botId: 123456 })
    const result = await signInWithTelegramWidget(signWidget(7501), post)
    expect(result).toEqual({ kind: 'ok' })
    const session = await auth.api.getSession({ headers: new Headers({ cookie: cookie() }) })
    expect(session?.user).toBeTruthy()
    expect(await db.query.users.findFirst()).toMatchObject({ telegramUserId: 7501n })
  })

  it('a payload signed with another token is rejected: no session, no user', async () => {
    const forged = { ...signWidget(7502), hash: 'a'.repeat(64) }
    expect(await signInWithTelegramWidget(forged, post)).toEqual({ kind: 'error' })
    expect(cookie()).not.toContain('session_token')
    expect(await db.query.users.findFirst()).toBeUndefined()
  })

  it('stale data is rejected', async () => {
    const stale = signWidget(7503, 2 * 60 * 60)
    expect(await signInWithTelegramWidget(stale, post)).toEqual({ kind: 'error' })
    expect(await db.query.users.findFirst()).toBeUndefined()
  })

  it('flag off: the server hides the button and the endpoint answers 404, no session', async () => {
    delete process.env.TELEGRAM_LOGIN_WIDGET_ENABLED
    expect(loginOptionsFromEnv(process.env)).toEqual({ telegramWidget: null })
    expect(await signInWithTelegramWidget(signWidget(7504), post)).toEqual({ kind: 'error' })
    expect(lastResponse?.status).toBe(404)
    expect(cookie()).not.toContain('session_token')
    expect(await db.query.users.findFirst()).toBeUndefined()
  })
})
