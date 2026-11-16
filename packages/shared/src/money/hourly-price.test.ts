import { describe, expect, it } from 'vitest'

import { formatHourlyPrice, parseHourlyPriceInput, VENUE_HOURLY_PRICE_MAX } from './hourly-price'

describe('parseHourlyPriceInput (21.4.13)', () => {
  it('treats an empty or blank field as "not set"', () => {
    expect(parseHourlyPriceInput('')).toEqual({ ok: true, value: null })
    expect(parseHourlyPriceInput('   ')).toEqual({ ok: true, value: null })
  })

  it('converts whole and fractional major units to kopecks', () => {
    expect(parseHourlyPriceInput('15')).toEqual({ ok: true, value: 1500 })
    expect(parseHourlyPriceInput('15.5')).toEqual({ ok: true, value: 1550 })
    expect(parseHourlyPriceInput('15,50')).toEqual({ ok: true, value: 1550 })
    expect(parseHourlyPriceInput(' 0,01 ')).toEqual({ ok: true, value: 1 })
  })

  it('rounds binary-fraction artefacts to the exact kopeck', () => {
    // 0.29 * 100 = 28.999999999999996, 1.005 не пройдёт формат, 19.99 * 100 = 1998.9999999999998
    expect(parseHourlyPriceInput('0.29')).toEqual({ ok: true, value: 29 })
    expect(parseHourlyPriceInput('19,99')).toEqual({ ok: true, value: 1999 })
    expect(parseHourlyPriceInput('4.35')).toEqual({ ok: true, value: 435 })
  })

  it('accepts zero as an explicit free price, distinct from empty', () => {
    expect(parseHourlyPriceInput('0')).toEqual({ ok: true, value: 0 })
    expect(parseHourlyPriceInput('0,00')).toEqual({ ok: true, value: 0 })
  })

  it('accepts the maximum and rejects anything above it', () => {
    expect(VENUE_HOURLY_PRICE_MAX).toBe(10_000_000)
    expect(parseHourlyPriceInput('100000')).toEqual({ ok: true, value: 10_000_000 })
    expect(parseHourlyPriceInput('100000.00')).toEqual({ ok: true, value: 10_000_000 })
    expect(parseHourlyPriceInput('100000.01')).toEqual({ ok: false })
    expect(parseHourlyPriceInput('9999999999999999')).toEqual({ ok: false })
  })

  it('rejects more than two decimals, signs, separators and text', () => {
    for (const bad of [
      '1.005',
      '15,555',
      '-1',
      '+5',
      '1 500',
      '1.',
      '.5',
      '15 BYN',
      'abc',
      '1e3',
    ]) {
      expect(parseHourlyPriceInput(bad), bad).toEqual({ ok: false })
    }
  })
})

describe('formatHourlyPrice (21.4.13)', () => {
  it('shows whole amounts without kopecks', () => {
    expect(formatHourlyPrice(1500, 'BYN')).toBe('15 BYN/ч')
  })

  it('shows kopecks with a ru-RU comma when present', () => {
    expect(formatHourlyPrice(1550, 'BYN')).toBe('15,50 BYN/ч')
    expect(formatHourlyPrice(1, 'BYN')).toBe('0,01 BYN/ч')
    expect(formatHourlyPrice(1999, 'USD')).toBe('19,99 USD/ч')
  })

  it('shows zero as a price, not as «Бесплатно»', () => {
    expect(formatHourlyPrice(0, 'BYN')).toBe('0 BYN/ч')
  })

  it('groups thousands the ru-RU way', () => {
    expect(formatHourlyPrice(10_000_000, 'BYN')?.replace(/\s/g, ' ')).toBe('100 000 BYN/ч')
  })

  it('returns null when the price is not set', () => {
    expect(formatHourlyPrice(null, 'BYN')).toBeNull()
    expect(formatHourlyPrice(undefined, 'BYN')).toBeNull()
  })
})
