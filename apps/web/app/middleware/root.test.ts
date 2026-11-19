import { beforeEach, describe, expect, it, vi } from 'vitest'

type Middleware = () => Promise<unknown>

describe('root route middleware (22.1.1)', () => {
  const user = { value: null as { id: string } | null }
  const fetchSession = vi.fn(async () => undefined)
  const navigateTo = vi.fn((to: string) => ({ redirectedTo: to }))
  let run: Middleware

  beforeEach(async () => {
    user.value = null
    fetchSession.mockClear()
    navigateTo.mockClear()
    vi.stubGlobal('defineNuxtRouteMiddleware', (fn: Middleware) => fn)
    vi.stubGlobal('useAuth', () => ({ user, fetchSession }))
    vi.stubGlobal('navigateTo', navigateTo)
    vi.resetModules()
    run = (await import('./root')).default as unknown as Middleware
  })

  it('loads the session once and sends a signed-out visitor to sign-in', async () => {
    expect(await run()).toEqual({ redirectedTo: '/auth/login' })
    expect(fetchSession).toHaveBeenCalledTimes(1)
  })

  it('does not decide the role on the client: a signed-in user passes, the server answers 403', async () => {
    user.value = { id: '1' }
    expect(await run()).toBeUndefined()
    expect(fetchSession).not.toHaveBeenCalled()
    expect(navigateTo).not.toHaveBeenCalled()
  })
})
