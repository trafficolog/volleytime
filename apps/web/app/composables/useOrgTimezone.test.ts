import { DEFAULT_TIMEZONE } from '@volley-time/shared'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { computed, effectScope, isRef, nextTick, ref, watch } from 'vue'

import { useOrgTimezone } from './useOrgTimezone'

afterEach(() => vi.unstubAllGlobals())

describe('organization timezone cache', () => {
  it('keeps delayed A timezone under A when B loads before A completes', async () => {
    const cache = ref<Record<number, string>>({})
    const replies = new Map<
      string,
      (value: { organization: { defaultTimezone: string } }) => void
    >()
    vi.stubGlobal('isRef', isRef)
    vi.stubGlobal('ref', ref)
    vi.stubGlobal('computed', computed)
    vi.stubGlobal('watch', watch)
    vi.stubGlobal('useState', () => cache)
    vi.stubGlobal('$fetch', (url: string) => new Promise((resolve) => replies.set(url, resolve)))
    const organization = ref(7)
    const scope = effectScope()
    const timezone = scope.run(() => useOrgTimezone(organization))!
    try {
      const first = timezone.load()
      organization.value = 8
      await nextTick()
      expect(timezone.tz.value).toBe(DEFAULT_TIMEZONE)
      replies.get('/api/organizations/8')!({ organization: { defaultTimezone: 'Asia/Tokyo' } })
      await nextTick()
      expect(timezone.tz.value).toBe('Asia/Tokyo')
      replies.get('/api/organizations/7')!({
        organization: { defaultTimezone: 'America/New_York' },
      })
      await first
      expect(timezone.tz.value).toBe('Asia/Tokyo')
      expect(cache.value).toEqual({ 7: 'America/New_York', 8: 'Asia/Tokyo' })
      organization.value = 7
      await nextTick()
      expect(timezone.tz.value).toBe('America/New_York')
    } finally {
      scope.stop()
    }
  })
})
