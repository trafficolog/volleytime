import { describe, expect, it } from 'vitest'

import { loginOptionsFromEnv } from './login-options'

describe('loginOptionsFromEnv (public sign-in options, D-05)', () => {
  it('hides the Telegram widget when the flag is unset or off', () => {
    expect(loginOptionsFromEnv({}, 'volleytime_bot')).toEqual({ telegramWidget: null })
    expect(
      loginOptionsFromEnv({ TELEGRAM_LOGIN_WIDGET_ENABLED: 'false' }, 'volleytime_bot'),
    ).toEqual({ telegramWidget: null })
  })

  it('hides the widget for an invalid flag value (fail closed)', () => {
    expect(
      loginOptionsFromEnv({ TELEGRAM_LOGIN_WIDGET_ENABLED: 'maybe' }, 'volleytime_bot'),
    ).toEqual({ telegramWidget: null })
  })

  it('exposes only the public bot username when the flag is on', () => {
    expect(
      loginOptionsFromEnv({ TELEGRAM_LOGIN_WIDGET_ENABLED: 'true' }, '@volleytime_bot'),
    ).toEqual({ telegramWidget: { botUsername: 'volleytime_bot' } })
  })

  it('hides the widget when the flag is on but the bot username is missing or malformed', () => {
    const env = { TELEGRAM_LOGIN_WIDGET_ENABLED: 'true' }
    expect(loginOptionsFromEnv(env, '')).toEqual({ telegramWidget: null })
    expect(loginOptionsFromEnv(env, undefined)).toEqual({ telegramWidget: null })
    expect(loginOptionsFromEnv(env, 'bad name"><script>')).toEqual({ telegramWidget: null })
  })

  it('never leaks secrets or other env values', () => {
    const body = JSON.stringify(
      loginOptionsFromEnv(
        { TELEGRAM_LOGIN_WIDGET_ENABLED: 'true', TELEGRAM_BOT_TOKEN: '111:SECRET' },
        'volleytime_bot',
      ),
    )
    expect(body).not.toContain('SECRET')
  })
})
