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
