<script setup lang="ts">
definePageMeta({ layout: 'miniapp-org', middleware: ['auth'] })
const route = useRoute()
const orgId = computed(() => Number(route.params.orgId))
const { tz, load } = useOrgTimezone(orgId)
await load()

// доступ проверяем до показа формы: игрок получит понятное сообщение (8.8.9)
const { data: orgData, error: orgError } = await useFetch<{
  myMember: { role: string; status: string }
}>(() => `/api/organizations/${orgId.value}`)
const canCreate = computed(() => {
  const m = orgData.value?.myMember
  return !!m && m.status === 'active' && ['owner', 'organizer'].includes(m.role)
})
</script>

<template>
  <div class="min-h-screen pb-10">
    <VtMiniHeader title="Новое событие" :back="`/m/orgs/${orgId}/events`" />
    <main class="px-4 py-4">
      <ErrorState v-if="orgError" message="Не удалось открыть группу" :retry="false" />
      <EmptyState
        v-else-if="!canCreate"
        icon="calendar"
        title="Создавать события могут организаторы"
        description="Попросите организатора группы добавить тренировку."
      />
      <EventForm
        v-else
        :org-id="orgId"
        :tz="tz"
        submit-label="Создать событие"
        @saved="(ev) => navigateTo(`/m/orgs/${orgId}/events/${ev.id}`)"
      />
    </main>
  </div>
</template>
