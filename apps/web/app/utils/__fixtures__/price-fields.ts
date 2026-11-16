/**
 * Поля цены ответа API для фикстур интеракционных тестов (21.5.9): из сценария цены события строит
 * `priceMode`, `targetAmount`, `pricingSettledAt`, `priceForecast` и `myShare` — то, что сервер отдаёт
 * вместо удалённой проекции `pricing`. Ожидаемые денежные цифры тестов не меняются: сценарий задаётся
 * теми же числами. Не часть приложения.
 */
import type { EventPriceBasis, EventPriceForecast, MyEventShare } from '@volley-time/shared'

export interface PriceScenario {
  mode: string
  targetAmount?: number | null
  settledAt?: string | null
  participantCount?: number
  minAmount?: number
  maxAmount?: number
  basis?: string
  myAllocatedAmount?: number | null
  myPaymentStatus?: MyEventShare['paymentStatus']
  /** Цена fixed-события в старых фикстурах (`price`), если `minAmount` не задан. */
  price?: number
}

export interface PriceFields {
  priceMode: 'fixed' | 'split'
  pricingSettledAt: string | null
  priceForecast: EventPriceForecast
  myShare: MyEventShare | null
  targetAmount?: number | null
}

export function priceFields(s: PriceScenario): PriceFields {
  const priceMode = s.mode === 'split' ? 'split' : 'fixed'
  const minAmount = s.minAmount ?? s.price ?? 0
  const allocatedAmount = s.myAllocatedAmount ?? null
  const paymentStatus = s.myPaymentStatus ?? null
  return {
    priceMode,
    pricingSettledAt: s.settledAt ?? null,
    ...('targetAmount' in s ? { targetAmount: s.targetAmount ?? null } : {}),
    priceForecast: {
      participantCount: s.participantCount ?? 0,
      minAmount,
      maxAmount: s.maxAmount ?? minAmount,
      basis: (s.basis ?? (priceMode === 'fixed' ? 'fixed' : 'current')) as EventPriceBasis,
    },
    myShare:
      allocatedAmount === null && paymentStatus === null
        ? null
        : { allocatedAmount, paymentStatus },
  }
}

/** Запись «Моих записей»: режим и фиксация — в строке события `event`, прогноз и доля — у записи. */
export function bookingPriceFields<E extends object>(s: PriceScenario, event: E) {
  const { priceMode, pricingSettledAt, targetAmount, ...rest } = priceFields(s)
  return {
    ...rest,
    event: {
      ...event,
      priceMode,
      pricingSettledAt,
      ...(targetAmount !== undefined ? { targetAmount } : {}),
    },
  }
}
