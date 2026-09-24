<script setup lang="ts">
import type { TabItem } from '~/components/vt/TabBar.vue'
import { subscriptionUiState, type SubscriptionBalance } from '~/utils/subscription-availability'

/** Layout экранов группы: контент + таб-бар по роли (Task 8.8.12). */
const route = useRoute()
const orgId = computed(() => Number(route.params.orgId))
const {
  data,
  error: orgError,
  refresh: refreshOrg,
} = await useFetch<{
  organization: { id: number; subscriptionsEnabled: boolean }
  myMember: { role: string; status: string }
}>(() => `/api/organizations/${orgId.value}`, { key: () => `org-nav-${orgId.value}` })
const { data: balanceData, refresh: refreshBalances } = await useFetch<{
  subscriptions: SubscriptionBalance[]
}>(() => `/api/organizations/${orgId.value}/subscriptions/my`, {
  key: () => `org-nav-balances-${orgId.value}`,
})
watch(
  () => route.fullPath,
  () => {
    void refreshOrg()
    void refreshBalances()
  },
)
const availability = computed(() =>
  subscriptionUiState(
    orgError.value || data.value?.organization?.id !== orgId.value
      ? null
      : data.value.organization.subscriptionsEnabled,
    orgId.value,
    balanceData.value?.subscriptions ?? [],
  ),
)
const isManager = computed(() => {
  const m = data.value?.myMember
  return !!m && m.status === 'active' && ['owner', 'organizer'].includes(m.role)
})
const base = computed(() => `/m/orgs/${orgId.value}`)
const tabs = computed<TabItem[]>(() =>
  isManager.value
    ? [
        { to: base.value, label: 'Главная', icon: 'home' },
        { to: `${base.value}/events`, label: 'События', icon: 'calendar', prefix: true },
        { to: `${base.value}/payments`, label: 'Оплаты', icon: 'wallet' },
        { to: `${base.value}/cashbox`, label: 'Касса', icon: 'chart' },
        { to: `${base.value}/members`, label: 'Игроки', icon: 'users' },
      ]
    : [
        { to: base.value, label: 'Главная', icon: 'home' },
        { to: `${base.value}/events`, label: 'События', icon: 'calendar', prefix: true },
        { to: `${base.value}/bookings`, label: 'Записи', icon: 'ticket' },
        ...(availability.value.showMenu
          ? [{ to: `${base.value}/subscriptions`, label: 'Абонементы', icon: 'card' as const }]
          : []),
      ],
)
</script>

<template>
  <div class="min-h-screen bg-vt-paper text-vt-ink pb-[calc(86px+env(safe-area-inset-bottom))]">
    <OfflineBanner />
    <slot />
    <VtTabBar :items="tabs" />
  </div>
</template>
