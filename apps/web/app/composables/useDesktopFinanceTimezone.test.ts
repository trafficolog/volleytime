import { formatDay } from '@volley-time/shared'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick, reactive, ref } from 'vue'

import { useDesktopFinanceTimezone } from './useDesktopFinanceTimezone'

afterEach(() => vi.unstubAllGlobals())

function harness() {
  const route = reactive({ path: '/app/orgs/7/payments' })
  const orgId = ref(7)
  const replies: {
    resolve: (value: { organization: { defaultTimezone: string } }) => void
    reject: (error: Error) => void
  }[] = []
  vi.stubGlobal('useRoute', () => route)
  vi.stubGlobal(
    'useRequestFetch',
    () => () => new Promise((resolve, reject) => replies.push({ resolve, reject })),
  )
  const scope = effectScope()
  const state = scope.run(() => useDesktopFinanceTimezone(orgId))!
  return { route, orgId, replies, scope, state }
}

describe('confirmed desktop finance timezone', () => {
  it('keeps crossing-midnight dates unavailable during delay/failure and renders New York after retry', async () => {
    const { state, replies, scope } = harness()
    try {
      const first = state.load()
      expect(state.timezone.value).toBeNull()
      expect(state.loading.value).toBe(true)
      replies[0]!.reject(new Error('metadata unavailable'))
      await first
      expect(state.timezone.value).toBeNull()
      expect(state.loading.value).toBe(false)
      expect(state.error.value).not.toBe('')
      const retry = state.load()
      expect(state.error.value).toBe('')
      expect(state.timezone.value).toBeNull()
      replies[1]!.resolve({ organization: { defaultTimezone: 'America/New_York' } })
      await retry
      expect(formatDay('2026-09-28T00:30:00Z', state.timezone.value!)).toBe('вс, 27 сент.')
    } finally {
      scope.stop()
    }
  })

  it('discards delayed original-org metadata after the destination zone is confirmed', async () => {
    const { state, replies, orgId, route, scope } = harness()
    try {
      const first = state.load()
      orgId.value = 8
      route.path = '/app/orgs/8/payments'
      await nextTick()
      expect(state.timezone.value).toBeNull()
      const second = state.load()
      replies[1]!.resolve({ organization: { defaultTimezone: 'Asia/Tokyo' } })
      await second
      replies[0]!.resolve({ organization: { defaultTimezone: 'America/New_York' } })
      await first
      expect(state.timezone.value).toBe('Asia/Tokyo')
      expect(state.error.value).toBe('')
    } finally {
      scope.stop()
    }
  })

  it('does not restore a confirmed zone after route leave or scope disposal', async () => {
    const { state, replies, route, scope } = harness()
    const first = state.load()
    route.path = '/app'
    await nextTick()
    scope.stop()
    replies[0]!.resolve({ organization: { defaultTimezone: 'America/New_York' } })
    await first
    expect(state.timezone.value).toBeNull()
  })

  it.each(['', 'not/a-zone'])('does not accept invalid metadata timezone %s', async (zone) => {
    const { state, replies, scope } = harness()
    try {
      const loaded = state.load()
      replies[0]!.resolve({ organization: { defaultTimezone: zone } })
      await loaded
      expect(state.timezone.value).toBeNull()
      expect(state.error.value).not.toBe('')
    } finally {
      scope.stop()
    }
  })
})
