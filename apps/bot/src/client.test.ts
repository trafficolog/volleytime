import { describe, expect, it, vi } from 'vitest'

import { createBot } from './client'
import { loggingMiddleware } from './middlewares/logging'

describe('bot client', () => {
  it('creates a Bot instance with token', () => {
    const bot = createBot()
    expect(bot).toBeDefined()
    expect(typeof bot.use).toBe('function')
    expect(typeof bot.command).toBe('function')
  })
})

describe('loggingMiddleware', () => {
  it('calls next and logs', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    const next = vi.fn().mockResolvedValue(undefined)
    const ctx = { from: { id: 42 }, update: { message: {} } } as never
    await loggingMiddleware(ctx, next)
    expect(next).toHaveBeenCalledOnce()
    expect(logSpy).toHaveBeenCalled()
    logSpy.mockRestore()
  })
})
