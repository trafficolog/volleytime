import { describe, expect, it } from 'vitest'

import { formatLinkCode, generateLinkCode, hashLinkCode, normalizeLinkCode } from './code'

describe('telegram chat link code (20.3.4)', () => {
  it('generates 8 symbols without ambiguous characters and does not repeat', () => {
    const seen = new Set<string>()
    for (let i = 0; i < 500; i++) {
      const code = generateLinkCode()
      expect(code).toMatch(/^[ABCDEFGHJKMNPQRSTUVWXYZ2-9]{8}$/)
      seen.add(code)
    }
    expect(seen.size).toBe(500)
  })

  it('shows ABCD-EFGH and accepts any case, dashes and spaces', () => {
    expect(formatLinkCode('ABCDEFGH')).toBe('ABCD-EFGH')
    expect(normalizeLinkCode('abcd-efgh')).toBe('ABCDEFGH')
    expect(normalizeLinkCode('  ABCD EFGH ')).toBe('ABCDEFGH')
  })

  it('rejects input that cannot be an issued code before it reaches the database', () => {
    for (const bad of ['', 'ABCDEFG', 'ABCDEFGHJ', 'ABCD-EFG0', 'ABCD-EFGI', "ABCD'EFG", 12, null])
      expect(normalizeLinkCode(bad)).toBeNull()
    expect(normalizeLinkCode('A'.repeat(1000))).toBeNull()
  })

  it('stores a SHA-256 hash, not the code', () => {
    const hash = hashLinkCode('ABCDEFGH')
    expect(hash).toMatch(/^[0-9a-f]{64}$/)
    expect(hash).not.toContain('ABCDEFGH')
    expect(hashLinkCode('ABCDEFGH')).toBe(hash)
    expect(hashLinkCode('ABCDEFGJ')).not.toBe(hash)
  })
})
