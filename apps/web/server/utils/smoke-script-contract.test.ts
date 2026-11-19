import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { afterEach, describe, expect, it } from 'vitest'

const script = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../../scripts/smoke.mjs',
)

/**
 * Контракт scripts/smoke.mjs c prepare (решение владельца 2026-11-19): перед Telegram-входом
 * технический аккаунт включается обратно, пока платформенная блокировка (22.1.4) его отключает.
 * Скрипт запускается как процесс против локального фейкового сервера, порядок запросов записывается.
 */
describe('scripts/smoke.mjs prepare step', () => {
  let server: Server | undefined
  afterEach(() => {
    server?.close()
    server = undefined
  })

  async function run(env: Record<string, string>, prepareBody: unknown, prepareStatus = 200) {
    const calls: string[] = []
    server = createServer((req, res) => {
      calls.push(`${req.method} ${req.url} ${req.headers['x-internal-secret'] ?? ''}`.trim())
      const send = (status: number, body: unknown, headers: Record<string, string> = {}) => {
        res.writeHead(status, { 'content-type': 'application/json', ...headers })
        res.end(JSON.stringify(body))
      }
      if (req.url === '/api/health') return send(200, { status: 'ok' })
      if (req.url === '/api/auth/get-session') return send(200, null)
      if (req.url === '/api/internal/smoke/prepare') return send(prepareStatus, prepareBody)
      if (req.url === '/api/auth/sign-in/telegram') {
        // подделку (подпись пустым токеном) отвергаем, настоящий вход проходит
        const forged = calls.filter((c) => c.includes('sign-in/telegram')).length > 1
        return forged ? send(401, {}) : send(200, {}, { 'set-cookie': 'session_token=x; Path=/' })
      }
      if (req.url === '/api/organizations') return send(200, [])
      if (req.url === '/api/internal/smoke/cleanup') return send(200, { cleaned: true })
      return send(404, {})
    })
    server.listen(0, '127.0.0.1')
    await once(server, 'listening')
    const port = (server.address() as AddressInfo).port
    // асинхронный spawn: фейковый сервер живёт в этом же процессе и должен отвечать
    const child = await new Promise<{ status: number | null; out: string }>((resolve) => {
      const p = spawn(process.execPath, [script], {
        env: { PATH: process.env.PATH ?? '', BASE_URL: `http://127.0.0.1:${port}`, ...env },
        timeout: 20_000,
      })
      let out = ''
      p.stdout.on('data', (d) => (out += d))
      p.stderr.on('data', (d) => (out += d))
      p.on('close', (status) => resolve({ status, out }))
    })
    return { calls, ...child }
  }
  const signed = {
    SMOKE_BOT_TOKEN: '123456:T',
    SMOKE_TG_ID: '900000001',
    BOT_INTERNAL_SECRET: 'sekret',
  }

  it('prepares the smoke account before signing in, then cleans up', async () => {
    const r = await run(signed, { prepared: true, reason: 'reenabled' })
    expect(r.status, r.out).toBe(0)
    const prepareAt = r.calls.findIndex((c) => c.includes('smoke/prepare'))
    const signInAt = r.calls.findIndex((c) => c.includes('sign-in/telegram'))
    const cleanupAt = r.calls.findIndex((c) => c.includes('smoke/cleanup'))
    expect(prepareAt).toBeGreaterThan(-1)
    expect(signInAt).toBeGreaterThan(prepareAt)
    expect(cleanupAt).toBeGreaterThan(signInAt)
    expect(r.calls[prepareAt]).toContain('sekret')
  })

  it('fails and does not sign in when the server refuses to prepare the account', async () => {
    const r = await run(signed, { prepared: false, reason: 'not_smoke_account' })
    expect(r.status).not.toBe(0) // 1 на Linux; Windows может отдать код краха libuv при process.exit
    expect(r.out).toContain('SMOKE FAILED: подготовка smoke-аккаунта')
    expect(r.calls.some((c) => c.includes('sign-in/telegram'))).toBe(false)
  })

  it('without BOT_INTERNAL_SECRET skips prepare and cleanup but still attempts sign-in', async () => {
    const r = await run({ SMOKE_BOT_TOKEN: signed.SMOKE_BOT_TOKEN, SMOKE_TG_ID: '900000001' }, {})
    expect(r.status, r.out).toBe(0)
    expect(r.out).toContain('BOT_INTERNAL_SECRET не задан')
    expect(r.calls.some((c) => c.includes('smoke/prepare'))).toBe(false)
    expect(r.calls.some((c) => c.includes('smoke/cleanup'))).toBe(false)
    expect(r.calls.some((c) => c.includes('sign-in/telegram'))).toBe(true)
  })

  it('without the smoke account env it neither prepares nor signs in', async () => {
    const r = await run({}, {})
    expect(r.status, r.out).toBe(0)
    expect(r.calls.some((c) => c.includes('smoke/prepare'))).toBe(false)
    expect(r.calls.some((c) => c.includes('sign-in/telegram'))).toBe(false)
  })
})
