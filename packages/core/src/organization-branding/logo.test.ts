import { describe, expect, it } from 'vitest'

import { LogoInvalidError, LogoTooLargeError } from './errors'
import { LOGO_MAX_BYTES, detectLogoMime, validateLogoUpload } from './logo'
import { isReservedShortLink, RESERVED_SHORT_LINKS } from './reserved'
import { SetShortLinkInput } from './short-link'

const PNG = Buffer.concat([
  Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex'),
  Buffer.alloc(17, 1),
])
const JPEG = Buffer.concat([Buffer.from('ffd8ffe000104a464946', 'hex'), Buffer.alloc(40, 2)])

describe('validateLogoUpload', () => {
  it('accepts PNG and JPEG whose declared type matches the bytes', () => {
    expect(validateLogoUpload({ declaredType: 'image/png', data: PNG })).toBe('image/png')
    expect(validateLogoUpload({ declaredType: 'image/jpeg', data: JPEG })).toBe('image/jpeg')
    expect(validateLogoUpload({ declaredType: 'IMAGE/PNG; charset=x', data: PNG })).toBe(
      'image/png',
    )
  })

  it('rejects SVG, GIF, HTML and scripts by content, whatever the declared type', () => {
    const svg = Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>',
    )
    const html = Buffer.from('<html><script>alert(1)</script></html>')
    const gif = Buffer.from('GIF89a' + 'x'.repeat(40))
    for (const [declaredType, data] of [
      ['image/svg+xml', svg],
      ['image/png', svg],
      ['image/png', html],
      ['image/gif', gif],
      ['image/png', gif],
      ['text/html', html],
    ] as const) {
      expect(() => validateLogoUpload({ declaredType, data })).toThrow(LogoInvalidError)
    }
  })

  it('rejects a declared type that does not match the bytes, or a missing type', () => {
    expect(() => validateLogoUpload({ declaredType: 'image/jpeg', data: PNG })).toThrow(
      LogoInvalidError,
    )
    expect(() => validateLogoUpload({ declaredType: 'image/png', data: JPEG })).toThrow(
      LogoInvalidError,
    )
    expect(() => validateLogoUpload({ declaredType: undefined, data: PNG })).toThrow(
      LogoInvalidError,
    )
  })

  it('rejects an empty file and a PNG signature without IHDR', () => {
    expect(() => validateLogoUpload({ declaredType: 'image/png', data: Buffer.alloc(0) })).toThrow(
      LogoInvalidError,
    )
    const noHeader = Buffer.concat([PNG.subarray(0, 12), Buffer.from('JUNK'), Buffer.alloc(17)])
    expect(() => validateLogoUpload({ declaredType: 'image/png', data: noHeader })).toThrow(
      LogoInvalidError,
    )
    expect(() =>
      validateLogoUpload({ declaredType: 'image/png', data: PNG.subarray(0, 9) }),
    ).toThrow(LogoInvalidError)
  })

  it('enforces the size limit exactly: 512 KB passes, one byte more does not', () => {
    expect(LOGO_MAX_BYTES).toBe(524_288)
    const ok = Buffer.concat([PNG, Buffer.alloc(LOGO_MAX_BYTES - PNG.length)])
    expect(ok.length).toBe(LOGO_MAX_BYTES)
    expect(validateLogoUpload({ declaredType: 'image/png', data: ok })).toBe('image/png')
    const big = Buffer.concat([ok, Buffer.alloc(1)])
    expect(() => validateLogoUpload({ declaredType: 'image/png', data: big })).toThrow(
      LogoTooLargeError,
    )
  })

  it('detects the type from the first bytes only', () => {
    expect(detectLogoMime(PNG)).toBe('image/png')
    expect(detectLogoMime(JPEG)).toBe('image/jpeg')
    expect(detectLogoMime(Buffer.from('<svg'))).toBeNull()
  })
})

describe('SetShortLinkInput', () => {
  const parse = (shortLink: unknown) => SetShortLinkInput.safeParse({ shortLink })

  it('normalizes case and whitespace', () => {
    expect(parse('  VT-Minsk ')).toMatchObject({ success: true, data: { shortLink: 'vt-minsk' } })
    expect(parse(null)).toMatchObject({ success: true, data: { shortLink: null } })
  })

  it('accepts the boundary lengths', () => {
    expect(parse('abc').success).toBe(true)
    expect(parse('a'.repeat(32)).success).toBe(true)
    expect(parse('a1-2b').success).toBe(true)
  })

  it.each([
    'ab',
    'a'.repeat(33),
    '-abc',
    'abc-',
    'a--b',
    'a_b',
    'abc.de',
    'абв',
    'a b',
    'ab/c',
    '',
  ])('rejects %j', (value) => {
    expect(parse(value).success).toBe(false)
  })

  it('rejects unknown keys and non-strings', () => {
    expect(SetShortLinkInput.safeParse({ shortLink: 'abc', slug: 'x' }).success).toBe(false)
    expect(parse(42).success).toBe(false)
    expect(SetShortLinkInput.safeParse({}).success).toBe(false)
  })
})

describe('reserved short links', () => {
  it.each(['app', 'm', 'api', 'admin', 'login', 'APP', 'Api'])('reserves %s', (word) => {
    expect(isReservedShortLink(word)).toBe(true)
  })

  it('does not reserve ordinary names, and every reserved word is lowercase', () => {
    expect(isReservedShortLink('vt-minsk')).toBe(false)
    expect(RESERVED_SHORT_LINKS.every((w) => w === w.toLowerCase())).toBe(true)
    expect(new Set(RESERVED_SHORT_LINKS).size).toBe(RESERVED_SHORT_LINKS.length)
  })
})
