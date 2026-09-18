import { describe, expect, it } from 'vitest'

import { resolveServerConfig } from './config'

describe('resolveServerConfig (3.9.2)', () => {
  it('reads plain env vars when NUXT_* runtimeConfig is empty', () => {
    const { config } = resolveServerConfig(
      { telegramBotToken: '', public: { telegramBotUsername: '' } },
      { TELEGRAM_BOT_TOKEN: '999:REAL', TELEGRAM_BOT_USERNAME: '@vt_bot', NODE_ENV: 'development' },
    )
    expect(config.telegramBotToken).toBe('999:REAL')
    expect(config.telegramBotUsername).toBe('vt_bot')
    expect(config.botInternalUrl).toBe('http://localhost:3001')
  })

  it('runtimeConfig (NUXT_*) wins over plain env', () => {
    const { config } = resolveServerConfig(
      { telegramBotToken: 'from-nuxt' },
      { TELEGRAM_BOT_TOKEN: 'from-env' },
    )
    expect(config.telegramBotToken).toBe('from-nuxt')
  })

  it('has no dev defaults for secrets in production and reports missing vars', () => {
    const { config, missing, isProduction } = resolveServerConfig({}, { NODE_ENV: 'production' })
    expect(isProduction).toBe(true)
    expect(config.botInternalSecret).toBe('')
    expect(config.botInternalUrl).toBe('')
    expect(missing).toEqual([
      'TELEGRAM_BOT_TOKEN',
      'TELEGRAM_BOT_USERNAME',
      'BOT_INTERNAL_URL',
      'BOT_INTERNAL_SECRET',
      'WEB_URL',
    ])
  })

  it('complete production env → nothing missing', () => {
    const { missing } = resolveServerConfig(
      {},
      {
        NODE_ENV: 'production',
        TELEGRAM_BOT_TOKEN: 't',
        TELEGRAM_BOT_USERNAME: 'b',
        BOT_INTERNAL_URL: 'http://bot:3001',
        BOT_INTERNAL_SECRET: 's',
        WEB_URL: 'https://volleytime.by/',
      },
    )
    expect(missing).toEqual([])
  })
})
