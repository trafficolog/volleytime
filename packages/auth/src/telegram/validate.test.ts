import { createHmac } from 'node:crypto'

import { describe, expect, it } from 'vitest'

import { TelegramAuthError, validateInitData } from './validate'

const BOT_TOKEN = '123456:TEST_TOKEN_ABC'

/** Формирует валидно подписанный initData (тот же алгоритм, что валидатор). */
function signInitData(params: Record<string, string>, token: string): string {
  const dataCheckString = Object.entries(params)
    .map(([k, v]) => `${k}=${v}`)
    .sort()
    .join('\n')
  const secretKey = createHmac('sha256', 'WebAppData').update(token).digest()
  const hash = createHmac('sha256', secretKey).update(dataCheckString).digest('hex')
  const sp = new URLSearchParams(params)
  sp.set('hash', hash)
  return sp.toString()
}

function now(): string {
  return String(Math.floor(Date.now() / 1000))
}

const validUser = JSON.stringify({ id: 42, first_name: 'Тест', username: 'tester' })

describe('validateInitData', () => {
  it('rejects initData older than 1 hour by default (3.9.10)', () => {
    const old = String(Math.floor(Date.now() / 1000) - 3601)
    const raw = signInitData({ user: validUser, auth_date: old }, BOT_TOKEN)
    expect(() => validateInitData(raw, BOT_TOKEN)).toThrow(/expired/)
  })

  it('rejects auth_date from the future (3.9.10)', () => {
    const future = String(Math.floor(Date.now() / 1000) + 600)
    const raw = signInitData({ user: validUser, auth_date: future }, BOT_TOKEN)
    expect(() => validateInitData(raw, BOT_TOKEN)).toThrow(/future/)
  })

  it('rejects user with invalid structure (3.9.10)', () => {
    for (const user of [
      '{bad json',
      JSON.stringify({ id: '42', first_name: 'X' }),
      JSON.stringify({ first_name: 'X' }),
    ]) {
      const raw = signInitData({ user, auth_date: now() }, BOT_TOKEN)
      expect(() => validateInitData(raw, BOT_TOKEN)).toThrow(/Invalid user/)
    }
  })

  it('SECURITY: rejects empty bot token even if initData is signed with empty string', () => {
    const raw = signInitData({ user: validUser, auth_date: now() }, '')
    expect(() => validateInitData(raw, '')).toThrow(/not configured/)
    expect(() => validateInitData(raw, '   ')).toThrow(TelegramAuthError)
  })

  it('accepts valid initData and parses user (id as bigint)', () => {
    const raw = signInitData({ user: validUser, auth_date: now() }, BOT_TOKEN)
    const result = validateInitData(raw, BOT_TOKEN)
    expect(result.user.id).toBe(42n)
    expect(result.user.first_name).toBe('Тест')
    expect(result.user.username).toBe('tester')
  })

  it('rejects tampered data (user changed after signing)', () => {
    let raw = signInitData({ user: validUser, auth_date: now() }, BOT_TOKEN)
    raw = raw.replace('42', '99')
    expect(() => validateInitData(raw, BOT_TOKEN)).toThrow(TelegramAuthError)
  })

  it('rejects wrong bot token', () => {
    const raw = signInitData({ user: validUser, auth_date: now() }, BOT_TOKEN)
    expect(() => validateInitData(raw, 'WRONG:TOKEN')).toThrow(/signature/)
  })

  it('rejects expired auth_date', () => {
    const old = String(Math.floor(Date.now() / 1000) - 100000)
    const raw = signInitData({ user: validUser, auth_date: old }, BOT_TOKEN)
    expect(() => validateInitData(raw, BOT_TOKEN, { maxAgeSeconds: 86400 })).toThrow(/expired/)
  })

  it('rejects missing hash', () => {
    expect(() => validateInitData('user=%7B%7D&auth_date=123', BOT_TOKEN)).toThrow(/Missing hash/)
  })

  it('rejects missing user', () => {
    const raw = signInitData({ auth_date: now() }, BOT_TOKEN)
    expect(() => validateInitData(raw, BOT_TOKEN)).toThrow(/Missing user/)
  })

  it('rejects missing auth_date', () => {
    const raw = signInitData({ user: validUser }, BOT_TOKEN)
    expect(() => validateInitData(raw, BOT_TOKEN)).toThrow(/auth_date/)
  })

  it('extracts start_param (deeplink) when present', () => {
    const raw = signInitData(
      { user: validUser, auth_date: now(), start_param: 'event_5' },
      BOT_TOKEN,
    )
    const result = validateInitData(raw, BOT_TOKEN)
    expect(result.start_param).toBe('event_5')
  })
})
