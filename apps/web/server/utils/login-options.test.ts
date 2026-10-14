import { describe, expect, it } from 'vitest'

import { botIdFromToken, loginOptionsFromEnv } from './login-options'

const on = { TELEGRAM_LOGIN_WIDGET_ENABLED: 'true' }

describe('botIdFromToken', () => {
  it.each([
    ['123456:ABC-secret', 123456],
    [' 7000000001:x ', 7000000001],
  ])('takes only the numeric public prefix of %s', (token, id) => {
    expect(botIdFromToken(token)).toBe(id)
  })
  it.each([
    [undefined],
    [''],
    ['no-colon'],
    [':abc'],
    ['12a:abc'],
    ['0:abc'],
    ['1'.repeat(20) + ':x'],
  ])('rejects malformed token %j', (token) => {
    expect(botIdFromToken(token)).toBeNull()
  })
})

describe('loginOptionsFromEnv (public sign-in options, D-05)', () => {
  it('hides the Telegram widget when the flag is unset or off', () => {
    const token = { TELEGRAM_BOT_TOKEN: '111:SECRET' }
    expect(loginOptionsFromEnv(token)).toEqual({ telegramWidget: null })
    expect(loginOptionsFromEnv({ ...token, TELEGRAM_LOGIN_WIDGET_ENABLED: 'false' })).toEqual({
      telegramWidget: null,
    })
  })

  it('hides the widget for an invalid flag value (fail closed)', () => {
    expect(
      loginOptionsFromEnv({ TELEGRAM_LOGIN_WIDGET_ENABLED: 'maybe', TELEGRAM_BOT_TOKEN: '111:S' }),
    ).toEqual({ telegramWidget: null })
  })

  it('exposes only the numeric bot id when the flag is on', () => {
    expect(loginOptionsFromEnv({ ...on, TELEGRAM_BOT_TOKEN: '111222:SECRET' })).toEqual({
      telegramWidget: { botId: 111222 },
    })
  })

  it('NUXT_TELEGRAM_BOT_TOKEN overrides TELEGRAM_BOT_TOKEN like the auth server', () => {
    expect(
      loginOptionsFromEnv({
        ...on,
        NUXT_TELEGRAM_BOT_TOKEN: '999:A',
        TELEGRAM_BOT_TOKEN: '111:B',
      }),
    ).toEqual({ telegramWidget: { botId: 999 } })
  })

  it('hides the widget when the flag is on but the token is missing or malformed', () => {
    expect(loginOptionsFromEnv(on)).toEqual({ telegramWidget: null })
    expect(loginOptionsFromEnv({ ...on, TELEGRAM_BOT_TOKEN: 'garbage' })).toEqual({
      telegramWidget: null,
    })
  })

  it('never leaks the secret part of the token', () => {
    const body = JSON.stringify(loginOptionsFromEnv({ ...on, TELEGRAM_BOT_TOKEN: '111:SECRET' }))
    expect(body).not.toContain('SECRET')
  })
})
