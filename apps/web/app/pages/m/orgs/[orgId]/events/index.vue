<script setup lang="ts">
import type { OrganizationMember } from '@volley-time/db'
import type { EventListItem } from '~/components/EventCard.vue'
definePageMeta({ layout: 'miniapp-org', middleware: ['auth'] })

const route = useRoute()
const orgId = computed(() => Number(route.params.orgId))
const { tz } = useOrgTimezone(orgId)

const { data: orgData } = await useFetch<{ myMember: OrganizationMember }>(
  () => `/api/organizations/${orgId.value}`,
)
const isManager = computed(() => {
  const m = orgData.value?.myMember
  return !!m && m.status === 'active' && ['owner', 'organizer'].includes(m.role)
})

const filter = ref<'upcoming' | 'past'>('upcoming')
const events = ref<EventListItem[]>([])
const loading = ref(false)
const error = ref('')

async function load() {
  loading.value = true
  error.value = ''
  try {
    const data = await $fetch<{ events: EventListItem[] }>(
      `/api/organizations/${orgId.value}/events`,
      { query: { filter: filter.value } },
    )
    events.value = data.events
  } catch (e) {
    error.value = apiErrorMessage(e, 'Не удалось загрузить события')
  } finally {
    loading.value = false
  }
}
await load()
watch(filter, load)
</script>

<template>
  <div class="min-h-screen pb-20">
    <VtMiniHeader title="События" :back="`/m/orgs/${orgId}`">
      <template v-if="isManager" #right>
        <NuxtLink :to="`/m/orgs/${orgId}/events/new`" class="vt-btn vt-btn--primary vt-btn--sm">
          <VtIcon name="plus" :size="14" /> Создать
        </NuxtLink>
      </template>
    </VtMiniHeader>
    <div class="px-4 pt-3 flex gap-1" role="tablist">
      <button
        v-for="f in [
          { id: 'upcoming', label: 'Предстоящие' },
          { id: 'past', label: 'Прошедшие' },
        ] as const"
        :key="f.id"
        type="button"
        role="tab"
        :aria-selected="filter === f.id"
        class="vt-btn vt-btn--sm flex-1 !rounded-full"
        :class="filter === f.id ? 'vt-btn--ink' : 'text-vt-mute-2'"
        @click="filter = f.id"
      >
        {{ f.label }}
      </button>
    </div>
    <main class="px-4 py-3">
      <SkeletonList v-if="loading" :count="3" />
      <ErrorState v-else-if="error" :message="error" @retry="load" />
      <EmptyState
        v-else-if="events.length === 0"
        icon="calendar"
        :title="filter === 'upcoming' ? 'Ближайших событий нет' : 'Прошедших событий нет'"
        :description="
          isManager && filter === 'upcoming' ? 'Создайте тренировку — игроки увидят её здесь' : ''
        "
      >
        <template v-if="isManager && filter === 'upcoming'" #action>
          <NuxtLink :to="`/m/orgs/${orgId}/events/new`" class="vt-btn vt-btn--primary">
            Создать событие
          </NuxtLink>
        </template>
      </EmptyState>
      <ul v-else class="space-y-2.5">
        <li v-for="ev in events" :key="ev.id">
          <EventCard :event="ev" :tz="tz" :to="`/m/orgs/${orgId}/events/${ev.id}`" />
        </li>
      </ul>
    </main>
  </div>
</template>
