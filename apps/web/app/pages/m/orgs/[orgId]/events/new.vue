<script setup lang="ts">
definePageMeta({ layout: 'miniapp-org', middleware: ['auth'] })
const route = useRoute()
const router = useRouter()
const orgId = computed(() => Number(route.params.orgId))
const {
  data: orgData,
  error: orgError,
  status: orgStatus,
} = await useFetch<{
  organization: {
    id: number
    defaultTimezone: string
    subscriptionsEnabled: boolean
    currency: string
  }
  capabilities: { eventSplitPricing: boolean }
  myMember: { role: string; status: string }
}>(() => `/api/organizations/${orgId.value}`, { key: () => `event-new-org-${orgId.value}` })
const org = computed(() =>
  orgStatus.value === 'success' &&
  !orgError.value &&
  Number.isInteger(orgId.value) &&
  orgId.value > 0 &&
  orgData.value?.organization.id === orgId.value
    ? orgData.value.organization
    : null,
)
const canCreate = computed(() => {
  const m = orgData.value?.myMember
  return !!org.value && !!m && m.status === 'active' && ['owner', 'organizer'].includes(m.role)
})
function onSaved(event: { id: number; organizationId: number }) {
  if (!canCreate.value || event.organizationId !== orgId.value) return
  if (Number(route.params.orgId) !== event.organizationId) return
  if (router.currentRoute.value.path !== `/m/orgs/${event.organizationId}/events/new`) return
  return navigateTo(`/m/orgs/${event.organizationId}/events/${event.id}`)
}
</script>

<template>
  <div class="min-h-screen pb-10">
    <VtMiniHeader title="Новое событие" :back="`/m/orgs/${orgId}/events`" />
    <main class="px-4 py-4">
      <SkeletonList v-if="orgStatus === 'pending'" :count="2" />
      <ErrorState v-else-if="orgError" message="Не удалось открыть группу" :retry="false" />
      <EmptyState
        v-else-if="!canCreate"
        icon="calendar"
        title="Создавать события могут организаторы"
        description="Попросите организатора группы добавить тренировку."
      />
      <EventForm
        v-else
        :key="orgId"
        :org-id="orgId"
        :tz="org!.defaultTimezone"
        :subscriptions-enabled="org!.subscriptionsEnabled"
        :currency="org!.currency"
        :split-pricing-enabled="orgData?.capabilities?.eventSplitPricing === true"
        submit-label="Создать событие"
        @saved="onSaved"
      />
    </main>
  </div>
</template>
