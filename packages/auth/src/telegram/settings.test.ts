import { describe, expect, it } from 'vitest'

import {
  loginWidgetEnabledFromEnv,
  TelegramConfigError,
  telegramAuthSettingsFromEnv,
} from './settings'

describe('telegramAuthSettingsFromEnv (19.3.1)', () => {
  it('defaults: initData 1 hour (3.9.10), Login Widget disabled, widget 1 hour', () => {
    expect(telegramAuthSettingsFromEnv({})).toEqual({
      initDataMaxAgeSeconds: 3600,
      loginWidget: { enabled: false, maxAgeSeconds: 3600 },
    })
  })

  it('reads configured values', () => {
    expect(
      telegramAuthSettingsFromEnv({
        TELEGRAM_INIT_DATA_MAX_AGE_SECONDS: '600',
        TELEGRAM_LOGIN_WIDGET_ENABLED: 'true',
        TELEGRAM_LOGIN_WIDGET_MAX_AGE_SECONDS: ' 300 ',
      }),
    ).toEqual({ initDataMaxAgeSeconds: 600, loginWidget: { enabled: true, maxAgeSeconds: 300 } })
    expect(
      telegramAuthSettingsFromEnv({ TELEGRAM_LOGIN_WIDGET_ENABLED: '0' }).loginWidget.enabled,
    ).toBe(false)
  })

  it.each([
    ['TELEGRAM_INIT_DATA_MAX_AGE_SECONDS', 'abc'],
    ['TELEGRAM_INIT_DATA_MAX_AGE_SECONDS', '-1'],
    ['TELEGRAM_INIT_DATA_MAX_AGE_SECONDS', '1.5'],
    ['TELEGRAM_INIT_DATA_MAX_AGE_SECONDS', '59'],
    ['TELEGRAM_INIT_DATA_MAX_AGE_SECONDS', '86401'],
    ['TELEGRAM_LOGIN_WIDGET_MAX_AGE_SECONDS', '0'],
    ['TELEGRAM_LOGIN_WIDGET_ENABLED', 'yes'],
  ])('fails closed on invalid %s=%s', (key, value) => {
    expect(() => telegramAuthSettingsFromEnv({ [key]: value })).toThrow(TelegramConfigError)
  })

  it('widget flag gate: only an explicit true enables, an invalid value stays off', () => {
    expect(loginWidgetEnabledFromEnv({})).toBe(false)
    expect(loginWidgetEnabledFromEnv({ TELEGRAM_LOGIN_WIDGET_ENABLED: 'true' })).toBe(true)
    expect(loginWidgetEnabledFromEnv({ TELEGRAM_LOGIN_WIDGET_ENABLED: '1' })).toBe(true)
    expect(loginWidgetEnabledFromEnv({ TELEGRAM_LOGIN_WIDGET_ENABLED: 'yes' })).toBe(false)
    expect(
      loginWidgetEnabledFromEnv({
        TELEGRAM_LOGIN_WIDGET_ENABLED: 'true',
        TELEGRAM_LOGIN_WIDGET_MAX_AGE_SECONDS: 'forever',
      }),
    ).toBe(true)
  })
})
