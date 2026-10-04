import type { EventPricingView } from '@volley-time/shared'
import { describe, expect, it } from 'vitest'

import { eventPricingLabel, splitBookingPaymentLabel } from './event-pricing-label'

const current: EventPricingView = {
  mode: 'split',
  targetAmount: 10000,
  settledAt: null,
  participantCount: 3,
  minAmount: 3333,
  maxAmount: 3334,
  basis: 'current',
  myAllocatedAmount: null,
  myPaymentStatus: null,
}

describe('event pricing labels', () => {
  it('keeps an open split waitlist uncharged while explaining possible promotion', () => {
    expect(splitBookingPaymentLabel(current, 'waitlisted')).toEqual({
      text: 'В листе ожидания',
      description:
        'Начисления нет. Доля появится только после перехода в состав и закрытия записи.',
      tone: 'default',
    })
  })
  it('does not promise promotion or a future charge for a settled split waitlist', () => {
    expect(
      splitBookingPaymentLabel(
        { ...current, basis: 'settled', settledAt: '2026-10-02T11:00:00Z' },
        'waitlisted',
      ),
    ).toEqual({
      text: 'В листе ожидания',
      description: 'Начисления нет. Запись закрыта; переход из листа ожидания в состав недоступен.',
      tone: 'default',
    })
  })
  it('unsettled_split_is_not_free_or_paid', () => {
    const label = eventPricingLabel(current, 'BYN')
    expect(label.text).toBe('≈ 33,33–33,34 BYN')
    expect(label.description).toContain('Прогноз')
    expect(label.description).toContain('закроет запись')
    expect(label.description).toContain('одну копейку')
    expect(label.payable).toBe(false)
    const changed = eventPricingLabel(
      { ...current, participantCount: 2, minAmount: 5000, maxAmount: 5000 },
      'BYN',
    )
    expect(changed.text).toBe('≈ 50,00 BYN')
  })
  it('labels capacity and zero minor forecasts without calling them free', () => {
    const label = eventPricingLabel(
      { ...current, basis: 'capacity', minAmount: 0, maxAmount: 1 },
      'BYN',
    )
    expect(label.text).toBe('≈ 0,00–0,01 BYN')
    expect(label.description).toContain('При полном составе')
    expect(label.payable).toBe(false)
  })
  it.each(['pending', 'succeeded', 'cancelled', 'refunded'] as const)(
    'preserves the exact own 100/3 allocation for %s',
    (status) => {
      const label = eventPricingLabel(
        {
          ...current,
          basis: 'settled',
          settledAt: '2026-10-02T12:00:00Z',
          myAllocatedAmount: 3334,
          myPaymentStatus: status,
        },
        'BYN',
      )
      expect(label.text).toBe('33,34 BYN')
      expect(label.description).toContain('Ваша доля')
      expect(label.payable).toBe(status === 'pending')
    },
  )
  it('shows only a range when settled without an own allocation', () => {
    expect(
      eventPricingLabel({ ...current, basis: 'settled', settledAt: '2026-10-02T12:00:00Z' }, 'BYN'),
    ).toEqual({ text: '33,33–33,34 BYN', description: 'Итоговая доля участника', payable: false })
  })
  it.each([0, 1500])('preserves fixed price %s', (amount) => {
    const label = eventPricingLabel(
      {
        ...current,
        mode: 'fixed',
        basis: 'fixed',
        targetAmount: null,
        minAmount: amount,
        maxAmount: amount,
      },
      'BYN',
    )
    expect(label.text).toBe(amount === 0 ? 'Бесплатно' : '15,00 BYN')
    expect(label.description).toBe('')
    expect(label.payable).toBe(amount > 0)
  })
})
