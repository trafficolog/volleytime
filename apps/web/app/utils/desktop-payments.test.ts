import { describe, expect, it } from 'vitest'

import {
  canSubmitDesktopPaymentAction,
  historyCursorForStatusChange,
  paymentMethodLabel,
  paymentStatusLabel,
  paymentTargetLabel,
  shouldReloadPaymentsAfterError,
} from './desktop-payments'

describe('desktop payment presentation and safety', () => {
  it('names every actual server status without attributing cancellations', () => {
    expect(
      (['pending', 'succeeded', 'cancelled', 'refunded'] as const).map(paymentStatusLabel),
    ).toEqual(['Ожидает подтверждения', 'Подтверждён', 'Отменён', 'Возвращён'])
    expect((['cash', 'transfer', 'online'] as const).map(paymentMethodLabel)).toEqual([
      'Наличные',
      'Перевод',
      'Онлайн',
    ])
  })
  it('resets continuation only when the filter changes', () => {
    expect(historyCursorForStatusChange('all', 'pending', 'opaque')).toBeNull()
    expect(historyCursorForStatusChange('pending', 'pending', 'opaque')).toBe('opaque')
  })
  it('refetches a conflict without predicting its resulting status', () => {
    expect(shouldReloadPaymentsAfterError('payment.not_pending')).toBe(true)
    expect(shouldReloadPaymentsAfterError(null)).toBe(false)
  })
  it('allows one action only in the captured route and organization', () => {
    expect(
      canSubmitDesktopPaymentAction('/app/orgs/7/payments', '/app/orgs/7/payments', 7, 7, false),
    ).toBe(true)
    expect(canSubmitDesktopPaymentAction('/app/orgs/7', '/app/orgs/7/payments', 7, 7, false)).toBe(
      false,
    )
    expect(
      canSubmitDesktopPaymentAction('/app/orgs/7/payments', '/app/orgs/7/payments', 7, 8, false),
    ).toBe(false)
    expect(
      canSubmitDesktopPaymentAction('/app/orgs/7/payments', '/app/orgs/7/payments', 7, 7, true),
    ).toBe(false)
  })
  it('preserves available targets and describes missing targets neutrally', () => {
    expect(paymentTargetLabel({ event: { title: 'Тренировка' }, plan: null })).toBe('Тренировка')
    expect(paymentTargetLabel({ event: null, plan: { name: 'Месяц' } })).toBe('Абонемент «Месяц»')
    expect(paymentTargetLabel({ event: null, plan: null })).toBe('Назначение недоступно')
  })
})
