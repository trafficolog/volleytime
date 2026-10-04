import type { EventPricingView } from '@volley-time/shared'

import { formatMoneyRu, formatPrice } from './labels'

/** Display server projections only: a forecast never becomes an amount to pay. */
export function eventPricingLabel(
  pricing: EventPricingView,
  currency: string,
): { text: string; description: string; payable: boolean } {
  if (pricing.mode === 'fixed') {
    return {
      text: formatPrice(pricing.minAmount, currency),
      description: '',
      payable: pricing.minAmount > 0,
    }
  }
  if (pricing.basis === 'settled' && pricing.myAllocatedAmount !== null) {
    return {
      text: formatMoneyRu(pricing.myAllocatedAmount, currency),
      description: 'Ваша доля после закрытия записи',
      payable: pricing.myPaymentStatus === 'pending',
    }
  }
  const amount =
    pricing.minAmount === pricing.maxAmount
      ? formatMoneyRu(pricing.minAmount, currency)
      : `${formatMoneyRu(pricing.minAmount, currency).replace(` ${currency}`, '')}–${formatMoneyRu(pricing.maxAmount, currency)}`
  if (pricing.basis === 'settled') {
    return { text: amount, description: 'Итоговая доля участника', payable: false }
  }
  return {
    text: `≈ ${amount}`,
    description: `${pricing.basis === 'capacity' ? 'При полном составе' : 'Прогноз по текущему составу'}. Точная сумма — когда организатор закроет запись. Из-за округления доли могут отличаться на одну копейку.`,
    payable: false,
  }
}

export function splitBookingPaymentLabel(pricing: EventPricingView, bookingStatus: string) {
  if (pricing.mode !== 'split') return null
  if (bookingStatus === 'waitlisted')
    return {
      text: 'В листе ожидания',
      description:
        pricing.basis === 'settled'
          ? 'Начисления нет. Запись закрыта; переход из листа ожидания в состав недоступен.'
          : 'Начисления нет. Доля появится только после перехода в состав и закрытия записи.',
      tone: 'default' as const,
    }
  if (pricing.myPaymentStatus === 'refunded')
    return { text: 'Возвращено', description: 'Оплата возвращена.', tone: 'default' as const }
  if (pricing.myPaymentStatus === 'cancelled')
    return {
      text: 'Платёж отменён',
      description: 'Платёж отменён организатором.',
      tone: 'default' as const,
    }
  if (bookingStatus === 'cancelled')
    return { text: 'Запись отменена', description: '', tone: 'default' as const }
  if (pricing.myAllocatedAmount === null)
    return {
      text: 'Расчёт позже',
      description: 'Сумма после закрытия записи. Пока оплачивать прогноз не нужно.',
      tone: 'amber' as const,
    }
  if (pricing.myPaymentStatus === 'succeeded')
    return {
      text: 'Оплачено',
      description: 'Оплата подтверждена организатором.',
      tone: 'grass' as const,
    }
  if (pricing.myPaymentStatus === 'pending')
    return {
      text: 'Ждёт оплаты',
      description: 'Оплатите точную долю организатору наличными или переводом.',
      tone: 'amber' as const,
    }
  return { text: 'Доля рассчитана', description: '', tone: 'default' as const }
}
