import { describe, expect, it } from 'vitest'

import { BOOKING_STATUS_LABELS, formatPrice, label } from './labels'

describe('labels (web unit, 3.9.6)', () => {
  it('label falls back to key', () => {
    expect(label(BOOKING_STATUS_LABELS, 'confirmed')).toBe('Записан')
    expect(label(BOOKING_STATUS_LABELS, 'unknown')).toBe('unknown')
  })
  it('formatPrice renders minor units', () => {
    expect(formatPrice(1500, 'BYN')).toBe('15,00 BYN')
    expect(formatPrice(123450, 'BYN').replace(/\s/g, ' ')).toBe('1 234,50 BYN')
  })
})
