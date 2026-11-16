export interface EventPricingView {
  mode: 'fixed' | 'split'
  targetAmount: number | null
  settledAt: string | null
  participantCount: number
  minAmount: number
  maxAmount: number
  basis: 'fixed' | 'current' | 'capacity' | 'settled'
  myAllocatedAmount: number | null
  myPaymentStatus: 'pending' | 'succeeded' | 'cancelled' | 'refunded' | null
}

/** Прогноз цены места события (21.5.10): замена `pricing.participantCount/min/max/basis`. */
export type EventPriceForecast = Pick<
  EventPricingView,
  'participantCount' | 'minAmount' | 'maxAmount' | 'basis'
>

/** Доля и статус оплаты своей записи (21.5.10): замена `pricing.myAllocatedAmount/myPaymentStatus`. */
export interface MyEventShare {
  allocatedAmount: number | null
  paymentStatus: EventPricingView['myPaymentStatus']
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
