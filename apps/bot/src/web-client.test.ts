import { afterEach, describe, expect, it, vi } from 'vitest'

import { callWeb } from './web-client'

describe('callWeb', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('sends the shared secret and query, returns JSON', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ games: [] })))
    vi.stubGlobal('fetch', fetchMock)
    expect(await callWeb('games', { query: { telegramId: '42' } })).toEqual({ games: [] })
    const [url, init] = fetchMock.mock.calls[0]!
    expect(String(url)).toContain('/api/internal/bot/games?telegramId=42')
    expect(init.headers['x-internal-secret']).toBe('dev-internal-secret')
  })

  it('returns null and logs neither the secret nor the telegram id on failure', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('no', { status: 429 })))
    expect(
      await callWeb('cancel-booking', { method: 'POST', body: { telegramId: '4242' } }),
    ).toBeNull()
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('boom dev-internal-secret 4242')))
    expect(await callWeb('my', { query: { telegramId: '4242' } })).toBeNull()
    const logged = JSON.stringify(warn.mock.calls)
    expect(logged).not.toContain('dev-internal-secret')
    expect(logged).not.toContain('4242')
    warn.mockRestore()
  })
})
