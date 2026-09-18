import type { Booking, Event, SubscriptionPlan, Subscription } from '@volley-time/db'

export function useEvents(orgId: Ref<number> | number) {
  const orgIdRef = isRef(orgId) ? orgId : ref(orgId)
  const events = ref<Event[]>([])
  const loading = ref(false)

  async function fetchList(filter: 'upcoming' | 'past' | 'all' = 'upcoming') {
    loading.value = true
    try {
      const data = await $fetch<{ events: Event[] }>(
        `/api/organizations/${orgIdRef.value}/events`,
        { query: { filter } },
      )
      events.value = data.events
    } finally {
      loading.value = false
    }
  }

  async function create(input: Record<string, unknown>) {
    const data = await $fetch<{ event: Event }>(`/api/organizations/${orgIdRef.value}/events`, {
      method: 'POST',
      body: input,
    })
    return data.event
  }

  return { events, loading, fetchList, create }
}

export function useBookings(orgId: Ref<number> | number) {
  const orgIdRef = isRef(orgId) ? orgId : ref(orgId)
  const myBookings = ref<(Booking & { event: Event })[]>([])
  const loading = ref(false)

  async function fetchMine(filter: 'upcoming' | 'past' | 'all' = 'upcoming') {
    loading.value = true
    try {
      const data = await $fetch<{ bookings: (Booking & { event: Event })[] }>(
        `/api/organizations/${orgIdRef.value}/bookings/my`,
        { query: { filter } },
      )
      myBookings.value = data.bookings
    } finally {
      loading.value = false
    }
  }

  async function book(eventId: number, method: string, subscriptionId?: number) {
    const data = await $fetch<{ booking: Booking }>(
      `/api/organizations/${orgIdRef.value}/events/${eventId}/bookings`,
      { method: 'POST', body: { method, subscriptionId } },
    )
    return data.booking
  }

  async function cancel(bookingId: number) {
    return $fetch(`/api/organizations/${orgIdRef.value}/bookings/${bookingId}/cancel`, {
      method: 'POST',
    })
  }

  return { myBookings, loading, fetchMine, book, cancel }
}

export function useSubscriptions(orgId: Ref<number> | number) {
  const orgIdRef = isRef(orgId) ? orgId : ref(orgId)
  const plans = ref<SubscriptionPlan[]>([])
  const mySubs = ref<Subscription[]>([])

  async function fetchPlans() {
    const data = await $fetch<{ plans: SubscriptionPlan[] }>(
      `/api/organizations/${orgIdRef.value}/plans`,
    )
    plans.value = data.plans
  }

  async function fetchMine() {
    const data = await $fetch<{ subscriptions: Subscription[] }>(
      `/api/organizations/${orgIdRef.value}/subscriptions/my`,
    )
    mySubs.value = data.subscriptions
  }

  async function buy(planId: number) {
    const data = await $fetch<{ subscription: Subscription }>(
      `/api/organizations/${orgIdRef.value}/subscriptions`,
      { method: 'POST', body: { planId } },
    )
    await fetchMine()
    return data.subscription
  }

  return { plans, mySubs, fetchPlans, fetchMine, buy }
}
