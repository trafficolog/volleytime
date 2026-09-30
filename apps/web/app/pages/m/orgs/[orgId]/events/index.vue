<script setup lang="ts">
import type { OrganizationMember } from '@volley-time/db'

import type { EventListItem } from '~/components/EventCard.vue'
import { playerAccessFromApiError } from '~/utils/player-home'
definePageMeta({ layout: 'miniapp-org', middleware: ['auth'] })

const route = useRoute()
const orgId = computed(() => Number(route.params.orgId))
const { tz } = useOrgTimezone(orgId)

const { data: orgData, error: orgError } = await useFetch<{
  organization: { id: number }
  myMember: OrganizationMember
}>(() => `/api/organizations/${orgId.value}`, { key: () => `org-events-access-${orgId.value}` })
const isManager = computed(() => {
  if (orgError.value || orgData.value?.organization.id !== orgId.value) return false
  const m = orgData.value?.myMember
  return !!m && m.status === 'active' && ['owner', 'organizer'].includes(m.role)
})

const filter = ref<'upcoming' | 'past'>('upcoming')
const events = ref<EventListItem[]>([])
const loading = ref(false)
const error = ref('')
const accessNotice = ref<ReturnType<typeof playerAccessFromApiError>>(null)
const canCreate = computed(() => isManager.value && !loading.value && !error.value)
const loadedOrgId = ref<number | null>(null)
const loadedFilter = ref<'upcoming' | 'past' | null>(null)
const visibleEvents = computed(() =>
  loadedOrgId.value === orgId.value && loadedFilter.value === filter.value ? events.value : [],
)
let requestSequence = 0

async function load() {
  const requestId = ++requestSequence
  const requestedOrgId = orgId.value
  const requestedFilter = filter.value
  loading.value = true
  error.value = ''
  accessNotice.value = null
  events.value = []
  loadedOrgId.value = null
  loadedFilter.value = null
  try {
    const data = await $fetch<{ events: EventListItem[] }>(
      `/api/organizations/${requestedOrgId}/events`,
      { query: { filter: requestedFilter } },
    )
    if (
      requestId !== requestSequence ||
      requestedOrgId !== orgId.value ||
      requestedFilter !== filter.value
    )
      return
    events.value = data.events
    loadedOrgId.value = requestedOrgId
    loadedFilter.value = requestedFilter
  } catch (e) {
    if (
      requestId !== requestSequence ||
      requestedOrgId !== orgId.value ||
      requestedFilter !== filter.value
    )
      return
    error.value = apiErrorMessage(e, 'Не удалось загрузить события')
    accessNotice.value = playerAccessFromApiError(apiErrorCode(e))
  } finally {
    if (requestId === requestSequence) loading.value = false
  }
}
await load()
watch([orgId, filter], load)
</script>

<template>
  <div class="min-h-screen pb-20">
    <VtMiniHeader title="События" :back="`/m/orgs/${orgId}`">
      <template v-if="isManager" #right>
        <button
          type="button"
          class="organizer-create-link vt-btn vt-btn--primary vt-btn--sm"
          aria-label="Создать событие"
          :disabled="!canCreate"
          @click="canCreate && navigateTo(`/m/orgs/${orgId}/events/new`)"
        >
          <VtIcon name="plus" :size="14" /> <span class="organizer-create-label">Создать</span>
        </button>
      </template>
    </VtMiniHeader>
    <div class="organizer-event-filters px-4 pt-3 flex gap-1" role="tablist">
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
      <PlayerAccessNotice v-else-if="accessNotice" :access="accessNotice" />
      <ErrorState v-else-if="error" :message="error" @retry="load" />
      <EmptyState
        v-else-if="visibleEvents.length === 0"
        icon="calendar"
        :title="filter === 'upcoming' ? 'Ближайших событий нет' : 'Прошедших событий нет'"
        :description="
          canCreate && filter === 'upcoming' ? 'Создайте тренировку — игроки увидят её здесь' : ''
        "
      >
        <template v-if="canCreate && filter === 'upcoming'" #action>
          <NuxtLink :to="`/m/orgs/${orgId}/events/new`" class="vt-btn vt-btn--primary">
            Создать событие
          </NuxtLink>
        </template>
      </EmptyState>
      <ul v-else :class="isManager ? 'divide-y divide-[var(--vt-stroke)]' : 'space-y-2.5'">
        <li v-for="ev in visibleEvents" :key="ev.id">
          <OrganizerEventRow
            v-if="isManager"
            :event="ev"
            :tz="tz"
            :to="`/m/orgs/${orgId}/events/${ev.id}/manage`"
          />
          <EventCard v-else :event="ev" :tz="tz" :to="`/m/orgs/${orgId}/events/${ev.id}`" />
        </li>
      </ul>
    </main>
  </div>
</template>

<style scoped>
@media (max-width: 200px) {
  .organizer-create-link {
    width: 44px;
    padding: 0;
  }

  .organizer-create-label {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
  }

  .organizer-event-filters {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
  }

  .organizer-event-filters button {
    width: 100%;
  }
}
</style>
