import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import * as h3 from 'h3'
import { afterEach, describe, expect, it } from 'vitest'

import { routeFromRelativeFile } from './harness'

const serverDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

/**
 * GET /api/auth/login-options должен обслуживаться собственным роутом, а не catch-all
 * better-auth (`[...auth].ts`): Nitro отдаёт статическому маршруту приоритет над `**`.
 */
describe('GET /api/auth/login-options is its own route (HTTP level)', () => {
  const env = {
    flag: process.env.TELEGRAM_LOGIN_WIDGET_ENABLED,
    token: process.env.TELEGRAM_BOT_TOKEN,
  }
  afterEach(() => {
    for (const [k, v] of [
      ['TELEGRAM_LOGIN_WIDGET_ENABLED', env.flag],
      ['TELEGRAM_BOT_TOKEN', env.token],
    ] as const) {
      if (v === undefined) delete process.env[k]
      else process.env[k] = v
    }
  })

  it('has a dedicated file next to the better-auth catch-all and maps to the right path', () => {
    expect(existsSync(path.join(serverDir, 'api/auth/[...auth].ts'))).toBe(true)
    expect(routeFromRelativeFile('auth/login-options.get.ts')).toEqual({
      method: 'get',
      route: '/api/auth/login-options',
    })
  })

  async function call(catchAllHit: { value: boolean }) {
    const g = globalThis as Record<string, unknown>
    g.defineEventHandler = h3.defineEventHandler
    g.setResponseHeader = h3.setResponseHeader
    const handler = (
      await import(pathToFileURL(path.join(serverDir, 'api/auth/login-options.get.ts')).href)
    ).default
    const router = h3.createRouter()
    router.get(
      '/api/auth/**',
      h3.defineEventHandler(() => ((catchAllHit.value = true), 'catch-all')),
    )
    router.get('/api/auth/login-options', handler)
    const web = h3.toWebHandler(h3.createApp().use(router))
    return web(new Request('http://test/api/auth/login-options'))
  }

  it('answers from its own handler with no-store and without secrets (flag on)', async () => {
    process.env.TELEGRAM_LOGIN_WIDGET_ENABLED = 'true'
    process.env.TELEGRAM_BOT_TOKEN = '424242:SECRET-PART'
    const hit = { value: false }
    const res = await call(hit)
    expect(hit.value).toBe(false)
    expect(res.status).toBe(200)
    expect(res.headers.get('cache-control')).toBe('no-store')
    const text = await res.text()
    expect(JSON.parse(text)).toEqual({ telegramWidget: { botId: 424242 } })
    expect(text).not.toContain('SECRET')
  })

  it('reports no widget when the flag is off', async () => {
    delete process.env.TELEGRAM_LOGIN_WIDGET_ENABLED
    process.env.TELEGRAM_BOT_TOKEN = '424242:SECRET-PART'
    const res = await call({ value: false })
    expect(await res.json()).toEqual({ telegramWidget: null })
  })
})
