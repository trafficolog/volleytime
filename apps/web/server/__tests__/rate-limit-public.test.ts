import * as h3 from 'h3'
import { beforeAll, describe, expect, it, vi } from 'vitest'

/**
 * Task 20.6.1: лимит на публичные маршруты — JSON `/api/public/**` и HTML `/e/<slug>` с одним
 * ключом клиента; вход (`/api/auth/**`) работает как прежде. Семантика за Caddy (`TRUSTED_PROXY=1`):
 * ключ — последний элемент X-Forwarded-For, адрес соединения — прокси.
 */
describe('rate limit middleware: public routes (20.6.1)', () => {
  type Init = { xff?: string; remote?: string }
  let call: (url: string, init?: Init) => Promise<number>

  beforeAll(async () => {
    vi.stubEnv('PUBLIC_RATE_LIMIT', '3')
    vi.stubEnv('PUBLIC_RATE_WINDOW_MS', '60000')
    vi.stubEnv('TRUSTED_PROXY', '1')
    Object.assign(globalThis, {
      defineEventHandler: h3.defineEventHandler,
      getRequestURL: h3.getRequestURL,
      getRequestHeader: h3.getRequestHeader,
      setResponseHeader: h3.setResponseHeader,
      createError: h3.createError,
    })
    const middleware = (await import('../middleware/00.rate-limit')).default
    const app = h3.createApp()
    // тестовый адрес соединения (у вызова внутри процесса его нет)
    app.use(
      h3.defineEventHandler((event) => {
        const remote = h3.getRequestHeader(event, 'x-test-remote')
        if (remote) Object.assign(event.node.req.socket, { remoteAddress: remote })
      }),
    )
    app.use(middleware)
    app.use(h3.defineEventHandler(() => 'ok'))
    const web = h3.toWebHandler(app)
    call = async (url, init = {}) =>
      (
        await web(
          new Request(`http://test${url}`, {
            headers: {
              ...(init.xff ? { 'x-forwarded-for': init.xff } : {}),
              ...(init.remote ? { 'x-test-remote': init.remote } : {}),
            },
          }),
        )
      ).status
  })

  const proxy = (xff: string): Init => ({ remote: '172.18.0.2', xff })

  it('limits GET /api/public/** per client behind the proxy and answers 429', async () => {
    const results = []
    for (let i = 0; i < 5; i++)
      results.push(await call('/api/public/events/0123456789ab', proxy('10.0.0.1')))
    expect(results).toEqual([200, 200, 200, 429, 429])
    // другой клиент не затронут; ключ — клиент, а не путь: перебор slug считается вместе
    expect(await call('/api/public/events/ffffffffffff', proxy('10.0.0.2'))).toBe(200)
    expect(await call('/api/public/events/aaaaaaaaaaaa', proxy('10.0.0.1'))).toBe(429)
  })

  it('throttles the HTML page /e/<slug> with the same per-client key as the JSON route', async () => {
    const client = proxy('10.0.1.1')
    expect(await call('/e/0123456789ab', client)).toBe(200)
    expect(await call('/api/public/events/0123456789ab', client)).toBe(200)
    expect(await call('/e/ffffffffffff', client)).toBe(200)
    expect(await call('/e/0123456789ab', client)).toBe(429)
    expect(await call('/api/public/events/0123456789ab', client)).toBe(429)
    expect(await call('/e/0123456789ab/', proxy('10.0.1.2'))).toBe(200)
  })

  it('SECURITY: a spoofed X-Forwarded-For prefix does not give a fresh bucket (last hop wins)', async () => {
    for (let i = 0; i < 3; i++)
      expect(await call('/e/0123456789ab', proxy(`evil-${i}, 10.0.2.1`))).toBe(200)
    expect(await call('/e/0123456789ab', proxy('another-fake, 10.0.2.1'))).toBe(429)
  })

  it('does not throttle in-process API calls (no connection address), even with forwarded headers', async () => {
    for (let i = 0; i < 6; i++) {
      expect(await call('/api/public/events/0123456789ab')).toBe(200)
      expect(await call('/api/public/events/0123456789ab', { xff: '10.0.3.1' })).toBe(200)
    }
  })

  it('without a trusted proxy the connection address is the key', async () => {
    vi.stubEnv('TRUSTED_PROXY', '0')
    try {
      for (let i = 0; i < 3; i++)
        expect(await call('/e/0123456789ab', { remote: '192.0.2.9', xff: `x${i}` })).toBe(200)
      expect(await call('/e/0123456789ab', { remote: '192.0.2.9', xff: 'y' })).toBe(429)
    } finally {
      vi.stubEnv('TRUSTED_PROXY', '1')
    }
  })

  it('does not touch other GET routes', async () => {
    for (let i = 0; i < 6; i++)
      expect(await call('/api/organizations', proxy('10.0.4.1'))).toBe(200)
    expect(await call('/events/0123456789ab', proxy('10.0.4.1'))).toBe(200)
  })
})
