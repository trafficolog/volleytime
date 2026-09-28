<script setup lang="ts">
import '~/assets/css/landing-fonts.css'

import type { TabItem } from '~/components/vt/TabBar.vue'
import { organizerMenuLinks, organizerTabItems } from '~/utils/organizer-miniapp'
import { playerTabs } from '~/utils/player-navigation'
import { subscriptionUiState, type SubscriptionBalance } from '~/utils/subscription-availability'

/** Layout экранов группы: контент + таб-бар по роли (Task 8.8.12). */
useHead({ htmlAttrs: { class: 'vt-miniapp-page' } })
const route = useRoute()
const orgId = computed(() => Number(route.params.orgId))
const menuOpen = ref(false)
const menuDialogId = 'organizer-menu-dialog'
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
watch(orgId, () => {
  menuOpen.value = false
})
const currentOrg = computed(
  () =>
    Number.isSafeInteger(orgId.value) &&
    orgId.value > 0 &&
    !orgError.value &&
    data.value?.organization?.id === orgId.value,
)
const availability = computed(() =>
  subscriptionUiState(
    !currentOrg.value ? null : data.value!.organization.subscriptionsEnabled,
    orgId.value,
    balanceData.value?.subscriptions ?? [],
  ),
)
const isManager = computed(() => {
  if (!currentOrg.value || data.value?.organization.status !== 'active') return false
  const m = data.value?.myMember
  return !!m && m.status === 'active' && ['owner', 'organizer'].includes(m.role)
})
const isActiveMember = computed(
  () =>
    currentOrg.value &&
    data.value?.organization.status === 'active' &&
    data.value.myMember?.status === 'active',
)
const base = computed(() => `/m/orgs/${orgId.value}`)
const menuLinks = computed(() =>
  currentOrg.value
    ? organizerMenuLinks(
        base.value,
        data.value?.myMember,
        data.value?.organization.subscriptionsEnabled === true,
      )
    : [],
)
const tabs = computed<TabItem[]>(() =>
  !isActiveMember.value
    ? []
    : isManager.value
      ? organizerTabItems(base.value)
      : playerTabs(base.value, availability.value),
)
function onTabAction(id: 'menu') {
  if (id === 'menu' && isManager.value) menuOpen.value = true
}

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
    class="miniapp-org-shell min-h-screen bg-vt-paper text-vt-ink"
    :class="!isManager ? 'vt-player' : undefined"
    :style="{
      '--player-dock-height': `${dockHeight}px`,
      paddingBottom: `calc(${dockHeight}px + 28px + env(safe-area-inset-bottom))`,
    }"
  >
    <OfflineBanner />
    <slot />
    <VtTabBar
      v-if="tabs.length"
      :items="tabs"
      :action-expanded="menuOpen"
      :action-controls="menuDialogId"
      @action="onTabAction"
    />
    <VtSheet v-if="currentOrg && isManager" :id="menuDialogId" v-model="menuOpen" title="Меню">
      <nav aria-label="Меню организатора" class="grid gap-1">
        <NuxtLink
          v-for="link in menuLinks"
          :key="link.to"
          :to="link.to"
          class="flex min-h-11 items-center rounded-xl px-3 text-sm font-medium hover:bg-vt-stroke/40 focus-visible:outline-2"
          @click="menuOpen = false"
        >
          {{ link.label }}
        </NuxtLink>
      </nav>
    </VtSheet>
  </div>
</template>
