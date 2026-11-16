import type { EventPriceForecast, EventPriceSource, MyEventShare } from '@volley-time/shared'

import { formatMoneyRu, formatPrice } from './labels'

/** Price fields of an API response (21.5.9); `null` — the response carries no forecast. */
export function priceSourceOf(x: {
  priceMode?: string
  priceForecast?: EventPriceForecast
  myShare?: MyEventShare | null
}): EventPriceSource | null {
  if (!x.priceForecast || (x.priceMode !== 'fixed' && x.priceMode !== 'split')) return null
  return { priceMode: x.priceMode, priceForecast: x.priceForecast, myShare: x.myShare ?? null }
}

/**
 * Display server projections only: a forecast never becomes an amount to pay. Source — event row
 * `priceMode`, `priceForecast` and `myShare` (21.5.10, 21.5.9).
 */
export function eventPricingLabel(
  source: EventPriceSource,
  currency: string,
): { text: string; description: string; payable: boolean } {
  const forecast = source.priceForecast
  const allocated = source.myShare?.allocatedAmount ?? null
  if (source.priceMode === 'fixed') {
    return {
      text: formatPrice(forecast.minAmount, currency),
      description: '',
      payable: forecast.minAmount > 0,
    }
  }
  if (forecast.basis === 'settled' && allocated !== null) {
    return {
      text: formatMoneyRu(allocated, currency),
      description: 'Ваша доля после закрытия записи',
      payable: source.myShare?.paymentStatus === 'pending',
    }
  }
  const amount =
    forecast.minAmount === forecast.maxAmount
      ? formatMoneyRu(forecast.minAmount, currency)
      : `${formatMoneyRu(forecast.minAmount, currency).replace(` ${currency}`, '')}–${formatMoneyRu(forecast.maxAmount, currency)}`
  if (forecast.basis === 'settled') {
    return { text: amount, description: 'Итоговая доля участника', payable: false }
  }
  return {
    text: `≈ ${amount}`,
    description: `${forecast.basis === 'capacity' ? 'При полном составе' : 'Прогноз по текущему составу'}. Точная сумма — когда организатор закроет запись. Из-за округления доли могут отличаться на одну копейку.`,
    payable: false,
  }
}

export function splitBookingPaymentLabel(source: EventPriceSource, bookingStatus: string) {
  if (source.priceMode !== 'split') return null
  const paymentStatus = source.myShare?.paymentStatus ?? null
  if (bookingStatus === 'waitlisted')
    return {
      text: 'В листе ожидания',
      description:
        source.priceForecast.basis === 'settled'
          ? 'Начисления нет. Запись закрыта; переход из листа ожидания в состав недоступен.'
          : 'Начисления нет. Доля появится только после перехода в состав и закрытия записи.',
      tone: 'default' as const,
    }
  if (paymentStatus === 'refunded')
    return { text: 'Возвращено', description: 'Оплата возвращена.', tone: 'default' as const }
  if (paymentStatus === 'cancelled')
    return {
      text: 'Платёж отменён',
      description: 'Платёж отменён организатором.',
      tone: 'default' as const,
    }
  if (bookingStatus === 'cancelled')
    return { text: 'Запись отменена', description: '', tone: 'default' as const }
  if ((source.myShare?.allocatedAmount ?? null) === null)
    return {
      text: 'Расчёт позже',
      description: 'Сумма после закрытия записи. Пока оплачивать прогноз не нужно.',
      tone: 'amber' as const,
    }
  if (paymentStatus === 'succeeded')
    return {
      text: 'Оплачено',
      description: 'Оплата подтверждена организатором.',
      tone: 'grass' as const,
    }
  if (paymentStatus === 'pending')
    return {
      text: 'Ждёт оплаты',
      description: 'Оплатите точную долю организатору наличными или переводом.',
      tone: 'amber' as const,
    }
  return { text: 'Доля рассчитана', description: '', tone: 'default' as const }
}
