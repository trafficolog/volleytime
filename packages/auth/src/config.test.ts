import { describe, expect, it } from 'vitest'

import { auth } from './config'

describe('better-auth base config', () => {
  it('instantiates auth instance', () => {
    expect(auth).toBeDefined()
  })

  it('exposes a request handler', () => {
    expect(typeof auth.handler).toBe('function')
  })

  it('exposes api methods', () => {
    expect(auth.api).toBeDefined()
  })

  it('has 30-day session configured', () => {
    expect(auth.options.session?.expiresIn).toBe(60 * 60 * 24 * 30)
  })

  it('disables email-password (custom providers only)', () => {
    expect(auth.options.emailAndPassword?.enabled).toBe(false)
  })

  it('has emailOTP plugin configured', () => {
    const pluginIds = auth.options.plugins?.map((p) => p.id) ?? []
    expect(pluginIds).toContain('email-otp')
  })
})
