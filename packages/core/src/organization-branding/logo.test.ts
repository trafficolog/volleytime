import { describe, expect, it } from 'vitest'

import { LogoInvalidError, LogoNotSquareError, LogoTooLargeError } from './errors'
import { LOGO_MAX_BYTES, detectLogoMime, logoDimensions, validateLogoUpload } from './logo'
import { isReservedShortLink, RESERVED_SHORT_LINKS } from './reserved'
import { SetShortLinkInput } from './short-link'
import { jpegBytes, pngBytes } from './test-fixtures'

const PNG = pngBytes(64)
const JPEG = jpegBytes(64)

const png = (data: Buffer) => validateLogoUpload({ declaredType: 'image/png', data })
const jpeg = (data: Buffer) => validateLogoUpload({ declaredType: 'image/jpeg', data })

describe('validateLogoUpload', () => {
  it('accepts square PNG and JPEG whose declared type matches the bytes', () => {
    expect(png(PNG)).toBe('image/png')
    expect(jpeg(JPEG)).toBe('image/jpeg')
    expect(validateLogoUpload({ declaredType: 'IMAGE/PNG; charset=x', data: PNG })).toBe(
      'image/png',
    )
    expect(jpeg(jpegBytes(300, 300, 0xc2))).toBe('image/jpeg') // progressive
    expect(jpeg(jpegBytes(1, 1))).toBe('image/jpeg')
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

  // каждая «почти подпись» совпадает с настоящей хотя бы по одному байту или по структуре
  describe('near-miss signatures', () => {
    const tail = Buffer.alloc(40, 1)
    const cases: [string, Buffer][] = [
      ['FF D8 00 (SOI without the third FF)', Buffer.concat([Buffer.from('ffd800', 'hex'), tail])],
      ['FF 00 (first byte only)', Buffer.concat([Buffer.from('ff00', 'hex'), tail])],
      ['D8 FF (SOI swapped)', Buffer.concat([Buffer.from('d8ffe0', 'hex'), tail])],
      [
        '89 + junk + IHDR (no PNG signature)',
        Buffer.concat([
          Buffer.from('89', 'hex'),
          Buffer.from('JUNKJUNKJUNK'),
          Buffer.from('IHDR'),
          tail,
        ]),
      ],
      [
        'PNG signature one byte off',
        Buffer.concat([Buffer.from('89504e470d0a1a0b', 'hex'), pngBytes(8).subarray(8)]),
      ],
      [
        'PNG signature without CRLF',
        Buffer.concat([Buffer.from('89504e47000a1a0a', 'hex'), pngBytes(8).subarray(8)]),
      ],
    ]

    it.each(cases)('%s is rejected for either declared type', (_label, data) => {
      expect(detectLogoMime(data)).toBeNull()
      expect(() => png(data)).toThrow(LogoInvalidError)
      expect(() => jpeg(data)).toThrow(LogoInvalidError)
    })

    it('a full PNG signature with a non-IHDR first chunk is corrupted', () => {
      const bad = Buffer.from(PNG)
      bad.write('IDAT', 12, 'latin1')
      expect(() => png(bad)).toThrow(LogoInvalidError)
    })

    it('a PNG shorter than its header and a bare JPEG signature are corrupted', () => {
      expect(() => png(PNG.subarray(0, 20))).toThrow(LogoInvalidError)
      expect(() => jpeg(Buffer.from('ffd8ff', 'hex'))).toThrow(LogoInvalidError)
      expect(() => jpeg(Buffer.from('ffd8ffe0', 'hex'))).toThrow(LogoInvalidError)
    })
  })

  it('rejects a declared type that does not match the bytes, or a missing type', () => {
    expect(() => jpeg(PNG)).toThrow(LogoInvalidError)
    expect(() => png(JPEG)).toThrow(LogoInvalidError)
    expect(() => validateLogoUpload({ declaredType: undefined, data: PNG })).toThrow(
      LogoInvalidError,
    )
  })

  it('rejects an empty file', () => {
    expect(() => png(Buffer.alloc(0))).toThrow(LogoInvalidError)
  })

  describe('square', () => {
    it('rejects non-square PNG and JPEG (width and height each larger)', () => {
      for (const data of [pngBytes(64, 32), pngBytes(32, 64)]) {
        expect(() => png(data)).toThrow(LogoNotSquareError)
      }
      for (const sof of [0xc0, 0xc1, 0xc2]) {
        expect(() => jpeg(jpegBytes(64, 32, sof))).toThrow(LogoNotSquareError)
        expect(() => jpeg(jpegBytes(32, 64, sof))).toThrow(LogoNotSquareError)
      }
      expect(() => png(pngBytes(100, 101))).toThrow(LogoNotSquareError)
    })

    it('rejects zero dimensions', () => {
      expect(() => png(pngBytes(0, 0))).toThrow(LogoInvalidError)
      expect(() => jpeg(jpegBytes(0, 0))).toThrow(LogoInvalidError)
    })

    it('reads the dimensions from the right fields', () => {
      expect(logoDimensions(pngBytes(123, 45), 'image/png')).toEqual({ width: 123, height: 45 })
      expect(logoDimensions(jpegBytes(123, 45), 'image/jpeg')).toEqual({ width: 123, height: 45 })
      expect(logoDimensions(jpegBytes(600, 300, 0xc2), 'image/jpeg')).toEqual({
        width: 600,
        height: 300,
      })
    })

    it('finds the frame after other segments, fill bytes and non-frame markers', () => {
      const dht = Buffer.from('ffc4000700000000ab', 'hex') // DHT: не SOF, длина 7 + маркер
      const withFill = Buffer.concat([
        Buffer.from('ffd8ffffe0', 'hex'),
        Buffer.from('0010', 'hex'),
        Buffer.from('4a46494600010100000100010000', 'hex'),
        dht.subarray(0, 9),
        jpegBytes(80, 80).subarray(2 + 18), // кадр и EOI после APP0
      ])
      expect(logoDimensions(withFill, 'image/jpeg')).toEqual({ width: 80, height: 80 })
    })

    it('treats truncated or SOF-less JPEG as corrupted, never reading past the end', () => {
      const full = jpegBytes(64)
      // обрезка в любой точке до конца кадра: размеров нет и ошибки чтения нет
      for (let n = 3; n < 2 + 18 + 9; n++) {
        expect(() => jpeg(full.subarray(0, n))).toThrow(LogoInvalidError)
      }
      // SOS раньше SOF
      const sos = Buffer.from('ffd8ffe000040000ffda0008000102030405', 'hex')
      expect(() => jpeg(sos)).toThrow(LogoInvalidError)
      // сегмент с длиной меньше 2 не зацикливает разбор
      const zero = Buffer.from('ffd8ffe00000' + '00'.repeat(20), 'hex')
      expect(() => jpeg(zero)).toThrow(LogoInvalidError)
      // длина сегмента уходит за конец файла
      const long = Buffer.from('ffd8ffe0ffff0102', 'hex')
      expect(() => jpeg(long)).toThrow(LogoInvalidError)
    })
  })

  it('enforces the size limit exactly: 1 MB passes, one byte more does not', () => {
    expect(LOGO_MAX_BYTES).toBe(1_048_576)
    const ok = pngBytes(64, 64, LOGO_MAX_BYTES - pngBytes(64).length)
    expect(ok.length).toBe(LOGO_MAX_BYTES)
    expect(png(ok)).toBe('image/png')
    expect(() => png(Buffer.concat([ok, Buffer.alloc(1)]))).toThrow(LogoTooLargeError)
    // размер проверяется раньше содержимого: огромный мусор получает 413, а не «не изображение»
    expect(() => png(Buffer.alloc(LOGO_MAX_BYTES + 1))).toThrow(LogoTooLargeError)
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
