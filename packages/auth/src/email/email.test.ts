import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { consoleEmailDriver } from './console-driver'
import { unisenderEmailDriver } from './unisender-driver'

import { getEmailDriver } from './index'

describe('getEmailDriver', () => {
  const orig = process.env.EMAIL_DRIVER
  afterEach(() => {
    process.env.EMAIL_DRIVER = orig
  })

  it('defaults to console driver when EMAIL_DRIVER unset', () => {
    delete process.env.EMAIL_DRIVER
    expect(getEmailDriver()).toBe(consoleEmailDriver)
  })

  it('returns console driver for EMAIL_DRIVER=console', () => {
    process.env.EMAIL_DRIVER = 'console'
    expect(getEmailDriver()).toBe(consoleEmailDriver)
  })

  it('returns unisender driver for EMAIL_DRIVER=unisender', () => {
    process.env.EMAIL_DRIVER = 'unisender'
    expect(getEmailDriver()).toBe(unisenderEmailDriver)
  })

  it('throws for unknown driver', () => {
    process.env.EMAIL_DRIVER = 'sendgrid'
    expect(() => getEmailDriver()).toThrow(/Unknown EMAIL_DRIVER/)
  })
})

describe('consoleEmailDriver', () => {
  let logSpy: ReturnType<typeof vi.spyOn>
  beforeEach(() => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
  })
  afterEach(() => {
    logSpy.mockRestore()
  })

  it('logs message to console (to, subject, text)', async () => {
    await consoleEmailDriver.send({ to: 'a@test.by', subject: 'Код', text: 'Ваш код: 1234' })
    const output = logSpy.mock.calls.map((c: unknown[]) => c.join(' ')).join('\n')
    expect(output).toContain('a@test.by')
    expect(output).toContain('Код')
    expect(output).toContain('1234')
  })
})

describe('unisenderEmailDriver', () => {
  it('throws not-implemented (Phase 9)', async () => {
    await expect(
      unisenderEmailDriver.send({ to: 'a@test.by', subject: 's', text: 't' }),
    ).rejects.toThrow(/not implemented/)
  })
})
