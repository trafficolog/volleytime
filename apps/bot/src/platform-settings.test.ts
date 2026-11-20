import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  BOT_SETTINGS_TTL_MS,
  getBotSettings,
  refreshBotSettings,
  resetBotSettings,
} from './platform-settings'
import { callWeb } from './web-client'

vi.mock('./web-client', () => ({ callWeb: vi.fn() }))
const web = vi.mocked(callWeb)

const DEFAULTS = { 'bot.callbackLimit': 8, 'bot.callbackWindowSeconds': 10 }
const reply = (limit: number, window: number) => ({
  settings: { 'bot.callbackLimit': limit, 'bot.callbackWindowSeconds': window },
})

/** Ждёт, пока фоновое обновление завершится (микрозадачи). */
const flush = () => new Promise((r) => setTimeout(r, 0))

describe('bot platform settings snapshot (22.3.1)', () => {
  beforeEach(() => {
    web.mockReset()
    resetBotSettings()
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('a click does not wait for the settings request: the first read returns defaults at once', async () => {
    let resolve!: (v: unknown) => void
    web.mockReturnValue(new Promise((r) => (resolve = r)))
    expect(getBotSettings()).toEqual(DEFAULTS) // синхронно, запрос ещё в пути
    expect(web).toHaveBeenCalledTimes(1)
    expect(web).toHaveBeenCalledWith('settings')
    expect(getBotSettings()).toEqual(DEFAULTS) // параллельный запрос не создаётся
    expect(web).toHaveBeenCalledTimes(1)
    resolve(reply(3, 20))
    await flush()
    expect(getBotSettings()).toEqual({ 'bot.callbackLimit': 3, 'bot.callbackWindowSeconds': 20 })
  })

  it('refreshes in the background after the TTL and keeps the expired snapshot until it returns', async () => {
    web.mockResolvedValueOnce(reply(3, 20))
    const t0 = Date.now()
    getBotSettings(t0)
    await flush()
    expect(getBotSettings(t0 + 1_000)['bot.callbackLimit']).toBe(3)
    expect(web).toHaveBeenCalledTimes(1) // в пределах TTL повторного запроса нет

    let resolve!: (v: unknown) => void
    web.mockReturnValueOnce(new Promise((r) => (resolve = r)))
    // TTL истёк: возвращается прежний снимок, а запрос идёт в фоне
    expect(getBotSettings(t0 + BOT_SETTINGS_TTL_MS + 5_000)['bot.callbackLimit']).toBe(3)
    expect(web).toHaveBeenCalledTimes(2)
    resolve(reply(50, 5))
    await flush()
    expect(getBotSettings(t0 + BOT_SETTINGS_TTL_MS + 5_001)).toEqual({
      'bot.callbackLimit': 50,
      'bot.callbackWindowSeconds': 5,
    })
  })

  it.each([
    ['a network error (web call returned null)', null],
    ['a malformed body', { nope: true }],
    ['an out-of-range limit', reply(0, 10)],
    ['a string limit', { settings: { 'bot.callbackLimit': '8', 'bot.callbackWindowSeconds': 10 } }],
    ['an out-of-range window', reply(8, 301)],
  ])('%s gives the defaults 8 / 10', async (_name, response) => {
    web.mockResolvedValueOnce(reply(3, 20))
    await refreshBotSettings()
    expect(getBotSettings()['bot.callbackLimit']).toBe(3)
    web.mockResolvedValueOnce(response)
    await refreshBotSettings()
    expect(getBotSettings()).toEqual(DEFAULTS)
  })

  it('a thrown error also gives the defaults and is retried after the TTL', async () => {
    web.mockRejectedValueOnce(new Error('boom'))
    await refreshBotSettings()
    const t0 = Date.now()
    expect(getBotSettings(t0)).toEqual(DEFAULTS)
    expect(web).toHaveBeenCalledTimes(1)
    web.mockResolvedValueOnce(reply(4, 15))
    expect(getBotSettings(t0 + BOT_SETTINGS_TTL_MS + 1)).toEqual(DEFAULTS) // ещё прежний снимок
    await flush()
    expect(getBotSettings(t0 + BOT_SETTINGS_TTL_MS + 2)).toEqual({
      'bot.callbackLimit': 4,
      'bot.callbackWindowSeconds': 15,
    })
  })
})
