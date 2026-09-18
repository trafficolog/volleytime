<script setup lang="ts">
import type { Event } from '@volley-time/db'
definePageMeta({ layout: 'miniapp-org', middleware: ['auth'] })
const route = useRoute()
const orgId = computed(() => Number(route.params.orgId))
const eventId = computed(() => Number(route.params.eventId))
const { tz, load } = useOrgTimezone(orgId)
await load()
const { data, error } = await useFetch<{ event: Event }>(
  () => `/api/organizations/${orgId.value}/events/${eventId.value}`,
)
</script>

<template>
  <div class="min-h-screen pb-10">
    <VtMiniHeader title="Редактирование" :back="`/m/orgs/${orgId}/events/${eventId}/manage`" />
    <main class="px-4 py-4">
      <ErrorState v-if="error" message="Не удалось открыть событие" :retry="false" />
      <EventForm
        v-else-if="data"
        :org-id="orgId"
        :tz="tz"
        :initial="data.event"
        submit-label="Сохранить"
        @saved="navigateTo(`/m/orgs/${orgId}/events/${eventId}/manage`)"
      />
    </main>
  </div>
</template>
