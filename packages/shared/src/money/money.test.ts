import { describe, expect, it } from 'vitest'

import { formatMoney, toMajor, toMinor } from './money'

describe('money: minor <-> major', () => {
  it('toMinor converts major units to integer minor (x100)', () => {
    expect(toMinor(5)).toBe(500)
    expect(toMinor(4.5)).toBe(450)
    expect(toMinor(0)).toBe(0)
  })

  it('toMinor rounds to nearest minor unit (no float drift)', () => {
    expect(toMinor(3.335)).toBe(334) // 3.335 -> 333.5 -> 334
    expect(toMinor(0.1)).toBe(10)
  })

  it('toMajor converts minor integer to major number', () => {
    expect(toMajor(500)).toBe(5)
    expect(toMajor(450)).toBe(4.5)
    expect(toMajor(0)).toBe(0)
  })

  it('toMinor rejects negative amounts', () => {
    expect(() => toMinor(-1)).toThrow()
  })
})

describe('money: formatMoney', () => {
  it('formats minor units as major with currency', () => {
    expect(formatMoney(500, 'BYN')).toBe('5.00 BYN')
    expect(formatMoney(450, 'BYN')).toBe('4.50 BYN')
    expect(formatMoney(12250, 'BYN')).toBe('122.50 BYN')
  })

  it('formats zero as "Бесплатно"', () => {
    expect(formatMoney(0, 'BYN')).toBe('Бесплатно')
  })
})
