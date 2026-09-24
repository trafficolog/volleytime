export function createSubscriptionViewLoader<TSubscription, TPlan>(
  getOrganizationId: () => number,
  canPurchase: () => boolean,
  fetchSubscriptions: (organizationId: number) => Promise<TSubscription[]>,
  fetchPlans: (organizationId: number) => Promise<TPlan[]>,
) {
  let latestRequest = 0

  return async (): Promise<
    { stale: true } | { stale: false; subscriptions: TSubscription[]; plans: TPlan[] }
  > => {
    const organizationId = getOrganizationId()
    const request = ++latestRequest
    const isCurrent = () => request === latestRequest && organizationId === getOrganizationId()

    try {
      const subscriptions = await fetchSubscriptions(organizationId)
      if (!isCurrent()) return { stale: true }

      const plans = canPurchase() ? await fetchPlans(organizationId) : []
      if (!isCurrent()) return { stale: true }

      return { stale: false, subscriptions, plans }
    } catch (error) {
      if (!isCurrent()) return { stale: true }
      throw error
    }
  }
}
