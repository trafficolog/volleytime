/** Базис прогноза цены места (21.5.10). */
export type EventPriceBasis = 'fixed' | 'current' | 'capacity' | 'settled'

/** Прогноз цены места события (21.5.10, `readEventPriceForecast`). */
export interface EventPriceForecast {
  participantCount: number
  minAmount: number
  maxAmount: number
  basis: EventPriceBasis
}

/** Доля и статус оплаты своей записи (21.5.10, `readMyEventShare`). */
export interface MyEventShare {
  allocatedAmount: number | null
  paymentStatus: 'pending' | 'succeeded' | 'cancelled' | 'refunded' | null
}

/** Поля ответа API, из которых экраны показывают цену события (21.5.9). */
export interface EventPriceSource {
  priceMode: 'fixed' | 'split'
  priceForecast: EventPriceForecast
  myShare: MyEventShare | null
}
export interface PricingFinancials {
  collected: number
  pending: number
  cancelled: number
  refunded: number
  currency: string
}

export interface PricingPermissions {
  canChangePriceMode: boolean
  canChangeTargetAmount: boolean
  canSettle: boolean
}
