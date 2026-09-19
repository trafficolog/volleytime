import { describe, expect, it, vi } from 'vitest'

import { FALLBACK_TEXT } from './handlers/fallback'
import {
  createShutdown,
  handleBotError,
  logFatalError,
  sanitizeOperationalError,
  withRetries,
} from './lifecycle'

describe('bot lifecycle (3.9.7)', () => {
  it('shutdown stops polling, closes servers and exits 0 once', async () => {
    const bot = { isRunning: () => true, stop: vi.fn(async () => {}) }
    const server = { close: vi.fn((cb?: () => void) => cb?.()) }
    const exit = vi.fn()
    const shutdown = createShutdown({ bot, servers: [server as never], exit })
    await shutdown('SIGTERM')
    await shutdown('SIGINT')
    expect(bot.stop).toHaveBeenCalledTimes(1)
    expect(server.close).toHaveBeenCalledTimes(1)
    expect(exit).toHaveBeenCalledWith(0)
  })

  it('withRetries retries with backoff and rethrows after last attempt (9.9.10)', async () => {
    const delays: number[] = []
    const sleep = async (ms: number) => {
      delays.push(ms)
    }
    let calls = 0
    const ok = await withRetries(
      async () => {
        calls++
        if (calls < 3) throw new Error('nope')
        return 'ready'
      },
      { attempts: 5, baseDelayMs: 10, sleep, label: 'test' },
    )
    expect(ok).toBe('ready')
    expect(delays).toEqual([10, 20])

    await expect(
      withRetries(
        async () => {
          throw new Error('always')
        },
        { attempts: 2, baseDelayMs: 5, sleep },
      ),
    ).rejects.toThrow('always')
  })

  it('redacts Telegram credentials from retry and fatal errors (9.9.12)', async () => {
    const token = '123456:secret-token-value'
    const requestUrl = `https://api.telegram.org/bot${token}/setMyCommands`
    const networkError = Object.assign(new Error(`request to ${requestUrl} failed`), {
      name: 'FetchError',
      code: 'ETIMEDOUT',
    })
    const apiError = Object.assign(new Error("Network request for 'setMyCommands' failed"), {
      name: 'HttpError',
      error: networkError,
    })
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})

    await expect(withRetries(async () => Promise.reject(apiError), { attempts: 1 })).rejects.toBe(
      apiError,
    )
    logFatalError(apiError)

    const serializedLogs = JSON.stringify(spy.mock.calls)
    expect(serializedLogs).not.toContain(token)
    expect(serializedLogs).not.toContain(requestUrl)
    expect(serializedLogs).toContain('[REDACTED]')
    expect(serializedLogs).toContain('ETIMEDOUT')
    expect(sanitizeOperationalError(apiError)).toEqual(
      expect.objectContaining({ name: 'HttpError', cause: expect.any(Object) }),
    )
    spy.mockRestore()
  })

  it('error handler logs instead of throwing', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() =>
      handleBotError({ ctx: { update: { update_id: 1 } }, error: new Error('boom') } as never),
    ).not.toThrow()
    expect(spy).toHaveBeenCalled()
    spy.mockRestore()
  })

  it('fallback text points to commands and the app', () => {
    expect(FALLBACK_TEXT).toContain('/start')
    expect(FALLBACK_TEXT).toContain('/help')
  })
})
