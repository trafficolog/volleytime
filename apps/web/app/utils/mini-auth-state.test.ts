import { describe, expect, it, vi } from 'vitest'
import { enterMiniApp } from './mini-auth-state'

describe('Mini App entry', () => {
  it('authenticates Telegram through the signed-initData callback before routing', async () => {
    const authenticate = vi.fn(async () => {})
    const fetchSession = vi.fn(async () => true)
    const result = await enterMiniApp({
      isTelegram: true,
      authenticate,
      fetchSession,
      targetRoute: async () => '/m/orgs/7',
    })
    expect(result).toEqual({ kind: 'navigate', to: '/m/orgs/7' })
    expect(authenticate).toHaveBeenCalledOnce()
    expect(fetchSession).not.toHaveBeenCalled()
  })

  it('sends an unauthenticated ordinary browser to email sign-in', async () => {
    const authenticate = vi.fn(async () => {})
    const result = await enterMiniApp({
      isTelegram: false,
      authenticate,
      fetchSession: async () => false,
      targetRoute: async () => '/m/orgs',
    })
    expect(result).toEqual({ kind: 'navigate', to: '/auth/login?redirect=/m/' })
    expect(authenticate).not.toHaveBeenCalled()
  })

  it('keeps signed-data failure distinct from browser session failure', async () => {
    const telegram = await enterMiniApp({
      isTelegram: true,
      authenticate: async () => {
        throw new Error('invalid initData')
      },
      fetchSession: async () => true,
      targetRoute: async () => '/m/orgs',
    })
    const browser = await enterMiniApp({
      isTelegram: false,
      authenticate: async () => {},
      fetchSession: async () => {
        throw new Error('offline')
      },
      targetRoute: async () => '/m/orgs',
    })
    expect(telegram).toEqual({ kind: 'telegram_error' })
    expect(browser).toEqual({ kind: 'browser_error' })
  })
})
