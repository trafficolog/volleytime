export interface SubscriptionBalance {
  organizationId: number
  status: string
  usedSessions: number
  totalSessions: number
  expiresAt: Date | string | null
}

export function subscriptionUiState(
  enabled: boolean | null,
  orgId: number,
  subscriptions: readonly SubscriptionBalance[],
  now = new Date(),
) {
  const hasBalance = subscriptions.some(
    (sub) =>
      sub.organizationId === orgId &&
      sub.status === 'active' &&
      sub.usedSessions < sub.totalSessions &&
      (sub.expiresAt == null || new Date(sub.expiresAt) > now),
  )
  return {
    showMenu: enabled === true || hasBalance,
    allowPurchase: enabled === true,
    allowBooking: enabled === true,
    readOnly: enabled !== true && hasBalance,
  }
}
