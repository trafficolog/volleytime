import { describe, expect, it } from 'vitest'

import { clientKeyFromRequest, RateLimiter } from './rate-limit'

describe('RateLimiter (9.9.11)', () => {
  it('allows up to the limit and then answers with retry-after', () => {
    let now = 1_000_000
    const limiter = new RateLimiter({ limit: 3, windowMs: 60_000, now: () => now })
    expect(limiter.check('ip').allowed).toBe(true)
    expect(limiter.check('ip').allowed).toBe(true)
    expect(limiter.check('ip').allowed).toBe(true)
    const blocked = limiter.check('ip')
    expect(blocked.allowed).toBe(false)
    expect(blocked.retryAfterSeconds).toBe(60)

    now += 60_001
    expect(limiter.check('ip').allowed).toBe(true)
  })

  it('counts keys independently', () => {
    const limiter = new RateLimiter({ limit: 1, windowMs: 1000 })
    expect(limiter.check('a').allowed).toBe(true)
    expect(limiter.check('b').allowed).toBe(true)
    expect(limiter.check('a').allowed).toBe(false)
  })
})

describe('clientKeyFromRequest (9.10.1)', () => {
  it('SECURITY: ignores a spoofed X-Forwarded-For without a trusted proxy', () => {
    const key = (forwardedFor: string) =>
      clientKeyFromRequest({ remoteAddress: '10.0.0.5', forwardedFor })
    expect(key('1.2.3.4')).toBe('10.0.0.5')
    expect(key('9.9.9.9')).toBe('10.0.0.5')
  })

  it('behind a trusted proxy takes the last element of the chain', () => {
    // клиент прислал свой X-Forwarded-For, Caddy дописал реальный адрес в конец
    expect(
      clientKeyFromRequest({
        remoteAddress: '172.18.0.2',
        forwardedFor: '1.2.3.4, 203.0.113.7',
        trustProxy: true,
      }),
    ).toBe('203.0.113.7')
  })

  it('falls back to the connection address and then to unknown', () => {
    expect(clientKeyFromRequest({ remoteAddress: '10.0.0.5', trustProxy: true })).toBe('10.0.0.5')
    expect(clientKeyFromRequest({})).toBe('unknown')
  })
})
