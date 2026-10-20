import { describe, expect, it } from 'vitest'

import {
  SEARCH_MAX_LENGTH,
  isSearchQueryValid,
  normalizeSearchQuery,
  stripAt,
  toContainsPattern,
} from './query'

describe('search query helpers (20.5.2)', () => {
  it('normalizes whitespace and length', () => {
    expect(normalizeSearchQuery('  Ива   Иванов \n')).toBe('Ива Иванов')
    expect(normalizeSearchQuery('a'.repeat(200))).toHaveLength(SEARCH_MAX_LENGTH)
  })

  it('requires at least two characters', () => {
    expect(isSearchQueryValid('')).toBe(false)
    expect(isSearchQueryValid('а')).toBe(false)
    expect(isSearchQueryValid('ан')).toBe(true)
  })

  it('escapes LIKE wildcards so the query is a literal substring', () => {
    expect(toContainsPattern('50%_a\\b')).toBe('%50\\%\\_a\\\\b%')
  })

  it('strips a leading @ from usernames', () => {
    expect(stripAt('@ivan')).toBe('ivan')
    expect(stripAt('ivan')).toBe('ivan')
  })
})
