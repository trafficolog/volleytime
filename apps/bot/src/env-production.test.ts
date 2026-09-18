import { describe, expect, it, vi } from 'vitest'

/** Task 8.8.2: в production бот не стартует без секретов. */
describe('bot env fail-fast in production', () => {
  it('throws without BOT_INTERNAL_SECRET / WEBHOOK_SECRET_TOKEN / WEB_URL', async () => {
    vi.resetModules()
    const prev = { ...process.env }
    process.env.NODE_ENV = 'production'
    process.env.TELEGRAM_BOT_TOKEN = '123:ABC'
    delete process.env.BOT_INTERNAL_SECRET
    delete process.env.WEB_URL
    delete process.env.WEBHOOK_SECRET_TOKEN
    await expect(import('./env')).rejects.toThrow(/required in production/)
    process.env = prev
    vi.resetModules()
  })
})
