<script setup lang="ts">
import type { Event } from '@volley-time/db'
definePageMeta({ layout: 'miniapp-org', middleware: ['auth'] })
const route = useRoute()
const orgId = computed(() => Number(route.params.orgId))
const eventId = computed(() => Number(route.params.eventId))
const routeKey = computed(() => `${orgId.value}:${eventId.value}`)
const {
  data: orgData,
  error: orgError,
  status: orgStatus,
} = await useFetch<{
  organization: { id: number; defaultTimezone: string; subscriptionsEnabled: boolean }
  myMember: { role: string; status: string }
}>(() => `/api/organizations/${orgId.value}`, { key: () => `event-edit-org-${orgId.value}` })
const { data, error, status } = await useFetch<{ event: Event }>(
  () => `/api/organizations/${orgId.value}/events/${eventId.value}`,
  { key: () => `event-edit-${routeKey.value}` },
)
const org = computed(() =>
  orgStatus.value === 'success' &&
  !orgError.value &&
  Number.isInteger(orgId.value) &&
  orgId.value > 0 &&
  orgData.value?.organization.id === orgId.value
    ? orgData.value.organization
    : null,
)
const canEdit = computed(() => {
  const member = orgData.value?.myMember
  return !!org.value && member?.status === 'active' && ['owner', 'organizer'].includes(member.role)
})
const currentEvent = computed(() => {
  const event = data.value?.event
  return status.value === 'success' &&
    !error.value &&
    event?.id === eventId.value &&
    event.organizationId === orgId.value
    ? event
    : null
})
function onSaved(event: Event) {
  if (!canEdit.value || event.organizationId !== orgId.value || event.id !== eventId.value) return
  if (
    Number(route.params.orgId) !== event.organizationId ||
    Number(route.params.eventId) !== event.id
  )
    return
  return navigateTo(`/m/orgs/${event.organizationId}/events/${event.id}/manage`)
}
</script>

<template>
  <div class="min-h-screen pb-10">
    <VtMiniHeader title="Редактирование" :back="`/m/orgs/${orgId}/events/${eventId}/manage`" />
    <main class="px-4 py-4">
      <SkeletonList v-if="orgStatus === 'pending' || status === 'pending'" :count="2" />
      <ErrorState v-else-if="orgError" message="Не удалось открыть группу" :retry="false" />
      <ErrorState v-else-if="error" message="Не удалось открыть событие" :retry="false" />
      <EmptyState
        v-else-if="!canEdit"
        icon="calendar"
        title="Редактировать события могут организаторы"
      />
      <EventForm
        v-else-if="currentEvent"
        :key="routeKey"
        :org-id="orgId"
        :tz="org!.defaultTimezone"
        :subscriptions-enabled="org!.subscriptionsEnabled"
        :initial="currentEvent"
        submit-label="Сохранить"
        @saved="onSaved"
      />
    </main>
  </div>
</template>
