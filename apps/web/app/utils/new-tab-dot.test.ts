import { describe, expect, it } from 'vitest'

import { COLLECTIONS_TAB_SEEN_KEY, isTabUnseen, markTabSeen } from './new-tab-dot'

function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial))
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
  }
}

describe('new tab dot', () => {
  it('is on until the tab has been opened once', () => {
    const storage = memoryStorage()
    expect(isTabUnseen(COLLECTIONS_TAB_SEEN_KEY, storage)).toBe(true)
    markTabSeen(COLLECTIONS_TAB_SEEN_KEY, storage)
    expect(isTabUnseen(COLLECTIONS_TAB_SEEN_KEY, storage)).toBe(false)
  })
  it('stays off when storage is unavailable or throws, so it never nags', () => {
    expect(isTabUnseen(COLLECTIONS_TAB_SEEN_KEY, null)).toBe(false)
    const broken = {
      getItem: () => {
        throw new Error('denied')
      },
      setItem: () => {
        throw new Error('denied')
      },
    }
    expect(isTabUnseen(COLLECTIONS_TAB_SEEN_KEY, broken)).toBe(false)
    expect(() => markTabSeen(COLLECTIONS_TAB_SEEN_KEY, broken)).not.toThrow()
  })
})
