import { describe, expect, it } from 'vitest'

import { slugify, uniqueSlug } from './slug'

describe('slugify', () => {
  it('transliterates cyrillic to latin', () => {
    expect(slugify('Волейбол Минск')).toBe('voleybol-minsk')
  })

  it('lowercases and hyphenates', () => {
    expect(slugify('VT Team 2026')).toBe('vt-team-2026')
  })

  it('collapses special chars and trims hyphens', () => {
    expect(slugify('  Клуб!!! №1  ')).toBe('klub-1')
  })

  it('handles mixed ru/en', () => {
    expect(slugify('Спорт Zone')).toBe('sport-zone')
  })

  it('caps at 64 chars', () => {
    expect(slugify('a'.repeat(100)).length).toBeLessThanOrEqual(64)
  })

  it('returns empty for only-special input', () => {
    expect(slugify('!!!')).toBe('')
  })
})

describe('uniqueSlug', () => {
  it('returns base slug when free', async () => {
    const result = await uniqueSlug('Минск', async () => false)
    expect(result).toBe('minsk')
  })

  it('appends -2 when base taken', async () => {
    const taken = new Set(['minsk'])
    const result = await uniqueSlug('Минск', async (s) => taken.has(s))
    expect(result).toBe('minsk-2')
  })

  it('finds next free suffix', async () => {
    const taken = new Set(['club', 'club-2', 'club-3'])
    const result = await uniqueSlug('Club', async (s) => taken.has(s))
    expect(result).toBe('club-4')
  })

  it('falls back to "org" for empty base', async () => {
    const result = await uniqueSlug('!!!', async () => false)
    expect(result).toBe('org')
  })
})
