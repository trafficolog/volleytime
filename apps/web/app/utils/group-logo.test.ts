import { describe, expect, it } from 'vitest'

import { groupLogoUrl, LOGO_MAX_BYTES, validateLogoFile, validateShortLink } from './group-logo'

describe('groupLogoUrl', () => {
  it('has no url without a logo', () => {
    expect(groupLogoUrl(5, null)).toBeNull()
    expect(groupLogoUrl(5, undefined)).toBeNull()
    expect(groupLogoUrl(5, 'not a date')).toBeNull()
  })

  it('points at the fixed route and carries the version', () => {
    const iso = '2026-11-08T10:00:00.000Z'
    expect(groupLogoUrl(5, iso)).toBe(`/api/organizations/5/logo?v=${Date.parse(iso)}`)
    expect(groupLogoUrl(5, new Date(iso))).toBe(groupLogoUrl(5, iso))
  })
})

describe('validateLogoFile', () => {
  const file = (size: number, type: string) => ({ name: 'l', size, type })

  it('accepts PNG and JPEG up to 1 MB', () => {
    expect(validateLogoFile(file(1, 'image/png'))).toBeNull()
    expect(validateLogoFile(file(LOGO_MAX_BYTES, 'image/jpeg'))).toBeNull()
  })

  it('rejects empty, oversized and other types', () => {
    expect(validateLogoFile(file(0, 'image/png'))).not.toBeNull()
    expect(validateLogoFile(file(LOGO_MAX_BYTES + 1, 'image/png'))).toContain('1 МБ')
    expect(validateLogoFile(file(10, 'image/svg+xml'))).toContain('SVG')
    expect(validateLogoFile(file(10, 'image/gif'))).not.toBeNull()
    expect(validateLogoFile(file(10, ''))).not.toBeNull()
  })
})

describe('validateShortLink', () => {
  it.each(['abc', 'vt-minsk', 'a1', 'a'.repeat(32)].filter((v) => v.length >= 3))(
    'accepts %s',
    (value) => {
      expect(validateShortLink(value)).toBeNull()
    },
  )

  it('normalizes case and whitespace before checking', () => {
    expect(validateShortLink('  VT-Minsk ')).toBeNull()
  })

  it.each(['', 'ab', 'a'.repeat(33), '-abc', 'abc-', 'a--b', 'a_b', 'абв', 'a b', 'a/b'])(
    'rejects %j',
    (value) => {
      expect(validateShortLink(value)).not.toBeNull()
    },
  )
})
