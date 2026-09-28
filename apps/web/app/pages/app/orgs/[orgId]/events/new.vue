<script setup lang="ts">
import { canSubmitDesktopEventAction } from '~/utils/desktop-event-actions'

definePageMeta({ layout: 'desktop-org', middleware: ['auth'] })

const route = useRoute()
const orgId = computed(() => Number(route.params.orgId))
const base = computed(() => `/app/orgs/${orgId.value}/events`)
const expectedPath = route.path
const { tz, load } = useOrgTimezone(orgId)
await load()
let alive = true
onBeforeUnmount(() => (alive = false))

function canSubmit() {
  return alive && canSubmitDesktopEventAction(route.path, expectedPath, false)
}

function saved(event: { id: number }) {
  if (canSubmit()) void navigateTo(`${base.value}/${event.id}`)
}
</script>

<template>
  <section class="vt-desktop-form-page space-y-5">
    <NuxtLink :to="base" class="vt-btn vt-btn--ghost">К событиям</NuxtLink>
    <header>
      <h1 tabindex="-1">Новое событие</h1>
      <p class="text-vt-mute-2">Создайте тренировку с рабочими полями текущего MVP.</p>
    </header>
    <div class="vt-card vt-desktop-form-page__card">
      <EventForm
        :org-id="orgId"
        :tz="tz"
        submit-label="Создать событие"
        :can-submit="canSubmit"
        @saved="saved"
      />
    </div>
  </section>
</template>
