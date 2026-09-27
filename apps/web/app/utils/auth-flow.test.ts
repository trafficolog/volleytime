import { describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

import type { AuthOrg } from './auth-destination'
import { botLink, completeEmailSignIn, continueEmailSignIn, switchEmailAccount } from './auth-flow'

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

describe('post-verification recovery', () => {
  it('retries session without a second OTP and preserves a player invitation', async () => {
    const verify = vi.fn(async () => {})
    let sessionAvailable = false
    const session = async () => sessionAvailable
    const fetchOrgs = vi.fn(async () => [{ ...owner, membershipRole: 'player' as const }])
    const first = await completeEmailSignIn({
      verify,
      session,
      fetchOrgs,
      redirect: '/m/invite/abc',
    })
    sessionAvailable = true
    const retry = await continueEmailSignIn({ session, fetchOrgs, redirect: '/m/invite/abc' })
    expect(first).toEqual({ kind: 'load_error' })
    expect(retry).toEqual({ kind: 'navigate', to: '/m/invite/abc' })
    expect(verify).toHaveBeenCalledOnce()
    expect(fetchOrgs).not.toHaveBeenCalled()
  })
})

describe('switching account', () => {
  it('returns to the email form after a successful sign-out on the same route', async () => {
    const step = ref<'email' | 'no_access'>('no_access')
    const email = ref('old@example.test')
    const code = ref('123456')
    const error = ref('')
    await switchEmailAccount({
      step,
      emailStep: 'email',
      email,
      code,
      error,
      signOut: async () => {},
    })
    expect({ step: step.value, email: email.value, code: code.value, error: error.value }).toEqual({
      step: 'email',
      email: '',
      code: '',
      error: '',
    })
  })

  it('keeps the current state and announces a sign-out failure', async () => {
    const step = ref<'email' | 'no_access'>('no_access')
    const email = ref('old@example.test')
    const code = ref('123456')
    const error = ref('')
    await switchEmailAccount({
      step,
      email,
      code,
      error,
      emailStep: 'email',
      signOut: async () => {
        throw new Error('offline')
      },
    })
    expect(step.value).toBe('no_access')
    expect(email.value).toBe('old@example.test')
    expect(error.value).toContain('выйти')
  })
})
