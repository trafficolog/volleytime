<script setup lang="ts">
import '~/assets/css/landing-fonts.css'

import type { TabItem } from '~/components/vt/TabBar.vue'
import { playerTabs } from '~/utils/player-navigation'
import { subscriptionUiState, type SubscriptionBalance } from '~/utils/subscription-availability'

/** Layout экранов группы: контент + таб-бар по роли (Task 8.8.12). */
useHead({ htmlAttrs: { class: 'vt-miniapp-page' } })
const route = useRoute()
const orgId = computed(() => Number(route.params.orgId))
const {
  data,
  error: orgError,
  refresh: refreshOrg,
} = await useFetch<{
  organization: { id: number; status: string; subscriptionsEnabled: boolean }
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
  const m = data.value?.organization.id === orgId.value ? data.value.myMember : null
  return !!m && m.status === 'active' && ['owner', 'organizer'].includes(m.role)
})
const isActiveMember = computed(
  () =>
    !orgError.value &&
    data.value?.organization.id === orgId.value &&
    data.value.organization.status === 'active' &&
    data.value.myMember?.status === 'active',
)
const base = computed(() => `/m/orgs/${orgId.value}`)
const tabs = computed<TabItem[]>(() => {
  if (!isActiveMember.value) return []
  return isManager.value
    ? [
        { to: base.value, label: 'Главная', icon: 'home' },
        { to: `${base.value}/events`, label: 'События', icon: 'calendar', prefix: true },
        { to: `${base.value}/payments`, label: 'Оплаты', icon: 'wallet' },
        { to: `${base.value}/cashbox`, label: 'Касса', icon: 'chart' },
        { to: `${base.value}/members`, label: 'Игроки', icon: 'users' },
      ]
    : playerTabs(base.value, availability.value)
})

// The dock can grow with text zoom; measure it instead of assuming 58 px.
const shell = useTemplateRef<HTMLElement>('shell')
const dockHeight = ref(58)
let dockObserver: ResizeObserver | undefined
onMounted(() => {
  dockObserver = new ResizeObserver(([entry]) => {
    if (entry) dockHeight.value = entry.target.getBoundingClientRect().height
  })
  void nextTick(() => {
    const dock = shell.value?.querySelector('.vt-tabbar')
    if (dock) dockObserver?.observe(dock)
  })
})
watch(tabs, async () => {
  await nextTick()
  dockObserver?.disconnect()
  const dock = shell.value?.querySelector('.vt-tabbar')
  if (dock) dockObserver?.observe(dock)
})
onUnmounted(() => dockObserver?.disconnect())
</script>

<template>
  <div
    ref="shell"
    class="min-h-screen bg-vt-paper text-vt-ink"
    :class="!isManager ? 'vt-player' : undefined"
    :style="{
      '--player-dock-height': `${dockHeight}px`,
      paddingBottom: `calc(${dockHeight}px + 28px + env(safe-area-inset-bottom))`,
    }"
  >
    <OfflineBanner />
    <slot />
    <VtTabBar v-if="tabs.length" :items="tabs" />
  </div>
</template>
