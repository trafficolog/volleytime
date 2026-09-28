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

export function subscriptionSections<T extends SubscriptionBalance>(
  orgId: number,
  subscriptions: readonly T[],
  now = new Date(),
) {
  const active: T[] = []
  const pending: T[] = []
  const history: T[] = []
  for (const sub of subscriptions) {
    if (sub.organizationId !== orgId) continue
    if (sub.status === 'pending') {
      pending.push(sub)
    } else if (
      sub.status === 'active' &&
      sub.usedSessions < sub.totalSessions &&
      (sub.expiresAt == null || new Date(sub.expiresAt) > now)
    ) {
      active.push(sub)
    } else {
      history.push(sub)
    }
  }
  return { active, pending, history }
}

export function canSubmitSubscriptionPurchase(
  orgId: number,
  allowPurchase: boolean,
  buying: boolean,
  plan: { id: number; organizationId: number; status: string } | null,
) {
  return (
    allowPurchase &&
    !buying &&
    !!plan &&
    plan.id > 0 &&
    plan.organizationId === orgId &&
    plan.status === 'active'
  )
}

export function subscriptionHistoryLabel(sub: SubscriptionBalance, now = new Date()) {
  if (sub.status === 'active') {
    if (sub.expiresAt != null && new Date(sub.expiresAt) <= now) return 'Истёк'
    if (sub.usedSessions >= sub.totalSessions) return 'Использован'
  }
  if (sub.status === 'expired') return 'Истёк'
  if (sub.status === 'exhausted') return 'Использован'
  if (sub.status === 'cancelled') return 'Отменён'
  return 'Абонемент'
}
