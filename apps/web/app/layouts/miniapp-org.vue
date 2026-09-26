<script setup lang="ts">
import type { TabItem } from '~/components/vt/TabBar.vue'
import { organizerMenuLinks, organizerTabItems, playerTabItems } from '~/utils/organizer-miniapp'
import { subscriptionUiState, type SubscriptionBalance } from '~/utils/subscription-availability'

/** Layout экранов группы: контент + таб-бар по роли (Task 8.8.12). */
const route = useRoute()
const orgId = computed(() => Number(route.params.orgId))
const menuOpen = ref(false)
const menuDialogId = 'organizer-menu-dialog'
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
  if (!currentOrg.value) return false
  const m = data.value?.myMember
  return !!m && m.status === 'active' && ['owner', 'organizer'].includes(m.role)
})
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
  isManager.value
    ? organizerTabItems(base.value)
    : playerTabItems(base.value, availability.value.showMenu),
)
function onTabAction(id: 'menu') {
  if (id === 'menu' && isManager.value) menuOpen.value = true
}
</script>

<template>
  <div class="min-h-screen bg-vt-paper text-vt-ink pb-[calc(86px+env(safe-area-inset-bottom))]">
    <OfflineBanner />
    <slot />
    <VtTabBar
      :items="tabs"
      :action-expanded="menuOpen"
      :action-controls="menuDialogId"
      @action="onTabAction"
    />
    <VtSheet v-if="isManager" :id="menuDialogId" v-model="menuOpen" title="Меню">
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
