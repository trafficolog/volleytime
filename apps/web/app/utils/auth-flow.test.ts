import { describe, expect, it, vi } from 'vitest'
import { botLink, completeEmailSignIn } from './auth-flow'
import type { AuthOrg } from './auth-destination'

const owner: AuthOrg = {
  id: 7,
  name: 'Команда',
  status: 'active',
  membershipRole: 'owner',
  membershipStatus: 'active',
}

describe('email sign-in completion', () => {
  it('does not load organizations or navigate after a rejected code', async () => {
    const fetchOrgs = vi.fn(async () => [owner])
    const result = await completeEmailSignIn({
      verify: async () => {
        throw new Error('invalid otp')
      },
      session: async () => true,
      fetchOrgs,
      redirect: undefined,
    })
    expect(result).toEqual({ kind: 'invalid_code' })
    expect(fetchOrgs).not.toHaveBeenCalled()
  })

  it('does not mislabel a missing session as an invalid code', async () => {
    const result = await completeEmailSignIn({
      verify: async () => {},
      session: async () => false,
      fetchOrgs: async () => [owner],
      redirect: undefined,
    })
    expect(result).toEqual({ kind: 'load_error' })
  })

  it('preserves a safe invitation after verified sign-in', async () => {
    const fetchOrgs = vi.fn(async () => [owner])
    const result = await completeEmailSignIn({
      verify: async () => {},
      session: async () => true,
      fetchOrgs,
      redirect: '/m/invite/abc',
    })
    expect(result).toEqual({ kind: 'navigate', to: '/m/invite/abc' })
    expect(fetchOrgs).not.toHaveBeenCalled()
  })

  it('chooses a real organizer route rather than an unsafe redirect', async () => {
    const result = await completeEmailSignIn({
      verify: async () => {},
      session: async () => true,
      fetchOrgs: async () => [owner],
      redirect: '/m/%2f%2fevil.test',
    })
    expect(result).toEqual({ kind: 'navigate', to: '/m/orgs/7' })
  })

  it('keeps API failure distinct from having no organizer access', async () => {
    const failed = await completeEmailSignIn({
      verify: async () => {},
      session: async () => true,
      fetchOrgs: async () => {
        throw new Error('offline')
      },
      redirect: undefined,
    })
    const empty = await completeEmailSignIn({
      verify: async () => {},
      session: async () => true,
      fetchOrgs: async () => [],
      redirect: undefined,
    })
    expect(failed).toEqual({ kind: 'load_error' })
    expect(empty).toEqual({ kind: 'none' })
  })
})

describe('Telegram entry link', () => {
  it('appears only for a configured bot username', () => {
    expect(botLink('volleytime_bot')).toBe('https://t.me/volleytime_bot')
    expect(botLink('')).toBeNull()
    expect(botLink('bad/path')).toBeNull()
  })
})
