import { afterEach, describe, expect, it, vi } from 'vitest'

import { trackFeatureEvent } from './feature-events'

describe('trackFeatureEvent (23.1.2)', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('posts the feature and kind and swallows errors', async () => {
    const fetchMock = vi.fn(async () => {
      throw new Error('offline')
    })
    vi.stubGlobal('$fetch', fetchMock)
    expect(() => trackFeatureEvent('cal', 'open')).not.toThrow()
    await Promise.resolve()
    expect(fetchMock).toHaveBeenCalledWith('/api/me/feature-events', {
      method: 'POST',
      body: { feature: 'cal', kind: 'open' },
    })
  })
})
