import type { User } from '@volley-time/db'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { computed, ref } from 'vue'

import { enterMiniApp } from '../utils/mini-auth-state'

import { useAuth } from './useAuth'

const existingUser: User = {
  id: 112,
  email: 'auth-qa@example.test',
  emailVerified: true,
  name: null,
  telegramUserId: null,
  telegramUsername: null,
  phone: null,
  image: null,
  isActive: true,
  isRootAdmin: false,
  createdAt: new Date('2026-09-25T00:00:00Z'),
  updatedAt: new Date('2026-09-25T00:00:00Z'),
}

function setup(
  fetcher: (url: string, options?: { method?: string; body?: object }) => Promise<unknown>,
) {
  const states = new Map<string, ReturnType<typeof ref>>()
  vi.stubGlobal('useState', (key: string, init: () => unknown) => {
    if (!states.has(key)) states.set(key, ref(init()))
    return states.get(key)
  })
  vi.stubGlobal('computed', computed)
  vi.stubGlobal('$fetch', fetcher)
  const navigate = vi.fn(async () => {})
  vi.stubGlobal('navigateTo', navigate)
  const auth = useAuth()
  auth.user.value = existingUser
  return { auth, navigate }
}

afterEach(() => vi.unstubAllGlobals())

describe('useAuth logout', () => {
  it('sends JSON accepted by the auth endpoint before clearing the user', async () => {
    const { auth, navigate } = setup(async (url, options) => {
      if (url !== '/api/auth/sign-out' || options?.method !== 'POST' || !options.body) {
        throw new Error('415 Content-Type is required. Allowed types: application/json')
      }
      return { success: true }
    })

    await auth.logout()

    expect(auth.user.value).toBeNull()
    expect(navigate).toHaveBeenCalledWith('/auth/login')
  })

  it('retains the user and current screen when sign-out fails', async () => {
    const { auth, navigate } = setup(async () => {
      throw new Error('offline')
    })

    await expect(auth.logout()).rejects.toThrow('offline')

    expect(auth.user.value).toEqual(existingUser)
    expect(navigate).not.toHaveBeenCalled()
  })
})

describe('useAuth session failures', () => {
  it('clears an existing user only when the session endpoint confirms no user', async () => {
    const { auth } = setup(async (url) => {
      if (url !== '/api/auth/get-session') throw new Error(`Unexpected request: ${url}`)
      return { user: null }
    })

    await auth.fetchSession()

    expect(auth.user.value).toBeNull()
    expect(auth.loading.value).toBe(false)
  })

  it('preserves an existing user and propagates a transient session error', async () => {
    const { auth } = setup(async (url) => {
      if (url !== '/api/auth/get-session') throw new Error(`Unexpected request: ${url}`)
      throw new Error('network unavailable')
    })

    await expect(auth.fetchSession()).rejects.toThrow('network unavailable')

    expect(auth.user.value).toEqual(existingUser)
    expect(auth.loading.value).toBe(false)
  })

  it('shows retryable browser entry when the real session fetch fails', async () => {
    const { auth } = setup(async (url) => {
      if (url !== '/api/auth/get-session') throw new Error(`Unexpected request: ${url}`)
      throw new Error('network unavailable')
    })
    auth.user.value = null

    const result = await enterMiniApp({
      isTelegram: false,
      authenticate: async () => {},
      fetchSession: async () => {
        await auth.fetchSession()
        return Boolean(auth.user.value)
      },
      targetRoute: async () => '/m/orgs',
    })

    expect(result).toEqual({ kind: 'browser_error' })
  })
})
