<script setup lang="ts">
import type { Event } from '@volley-time/db'

import { canSubmitDesktopEventAction } from '~/utils/desktop-event-actions'

definePageMeta({ layout: 'desktop-org', middleware: ['auth'] })

const route = useRoute()
const orgId = computed(() => Number(route.params.orgId))
const eventId = computed(() => Number(route.params.eventId))
const base = computed(() => `/app/orgs/${orgId.value}/events/${eventId.value}`)
const expectedPath = route.path
const { tz, load } = useOrgTimezone(orgId)
await load()
const { data, pending, error, refresh } = await useFetch<{ event: Event }>(
  () => `/api/organizations/${orgId.value}/events/${eventId.value}`,
  { key: () => `desktop-event-edit-${orgId.value}-${eventId.value}` },
)
const event = computed(() => {
  const candidate = data.value?.event
  return candidate?.id === eventId.value && candidate.organizationId === orgId.value
    ? candidate
    : null
})
let alive = true
onBeforeUnmount(() => (alive = false))

function canSubmit() {
  return alive && canSubmitDesktopEventAction(route.path, expectedPath, false)
}

function saved() {
  if (canSubmit()) void navigateTo(base.value)
}
</script>

<template>
  <section class="vt-desktop-form-page space-y-5">
    <NuxtLink :to="base" class="vt-btn vt-btn--ghost">К событию</NuxtLink>
    <h1 tabindex="-1">Редактирование события</h1>
    <SkeletonList v-if="pending" :count="2" />
    <ErrorState
      v-else-if="error || !event"
      message="Не удалось открыть событие"
      @retry="refresh()"
    />
    <div v-else class="vt-card vt-desktop-form-page__card">
      <EventForm
        :key="`${orgId}-${eventId}`"
        :org-id="orgId"
        :tz="tz"
        :initial="event"
        submit-label="Сохранить событие"
        :can-submit="canSubmit"
        @saved="saved"
      />
    </div>
  </section>
</template>
