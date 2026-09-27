<script setup lang="ts">
import type { EventListItem } from '~/components/EventCard.vue'
import { appendDesktopEventPage } from '~/utils/desktop-calendar'

definePageMeta({ layout: 'desktop-org', middleware: ['auth'] })

const route = useRoute()
const orgId = computed(() => Number(route.params.orgId))
const base = computed(() => `/app/orgs/${orgId.value}`)
const { tz } = useOrgTimezone(orgId)
const filter = ref<'upcoming' | 'past' | 'all'>('upcoming')
const view = ref<'list' | 'calendar'>('list')
const events = ref<EventListItem[]>([])
const loading = ref(false)
const error = ref('')
const hasMore = ref(false)
let generation = 0

async function loadPage(offset: number) {
  if (loading.value) return
  const token = generation
  const targetOrgId = orgId.value
  const targetFilter = filter.value
  loading.value = true
  error.value = ''
  try {
    const result = await $fetch<{ events: EventListItem[] }>(
      `/api/organizations/${targetOrgId}/events`,
      { query: { filter: targetFilter, limit: 50, offset } },
    )
    if (token !== generation || orgId.value !== targetOrgId || filter.value !== targetFilter) return
    events.value = appendDesktopEventPage(events.value, result.events, offset)
    hasMore.value = result.events.length === 50
  } catch (cause) {
    if (token !== generation || orgId.value !== targetOrgId || filter.value !== targetFilter) return
    error.value = apiErrorMessage(cause, 'Не удалось загрузить события')
  } finally {
    if (token === generation) loading.value = false
  }
}

watch(
  [orgId, filter],
  () => {
    generation++
    events.value = []
    loading.value = false
    error.value = ''
    hasMore.value = false
    void loadPage(0)
  },
  { immediate: true },
)
onBeforeUnmount(() => generation++)
</script>

<template>
  <div class="vt-desktop-events space-y-6">
    <header class="vt-desktop-dashboard__heading">
      <div>
        <p class="vt-cap">Управление группой</p>
        <h1 tabindex="-1">События</h1>
        <p class="text-vt-mute-2">Список и календарь используют одну загруженную выборку.</p>
      </div>
      <NuxtLink :to="`${base}/events/new`" class="vt-btn vt-btn--primary">
        <VtIcon name="plus" :size="16" /> Новое событие
      </NuxtLink>
    </header>

    <div class="vt-desktop-events__controls">
      <div class="vt-desktop-events__filters" aria-label="Период событий">
        <button
          v-for="option in [
            { key: 'upcoming', label: 'Предстоящие' },
            { key: 'past', label: 'Прошедшие' },
            { key: 'all', label: 'Все' },
          ] as const"
          :key="option.key"
          type="button"
          class="vt-btn vt-btn--sm"
          :class="filter === option.key ? 'vt-btn--ink' : 'vt-btn--ghost'"
          :aria-pressed="filter === option.key"
          @click="filter = option.key"
        >
          {{ option.label }}
        </button>
      </div>
      <div class="vt-desktop-events__filters" aria-label="Вид событий">
        <button
          v-for="option in [
            { key: 'list', label: 'Список' },
            { key: 'calendar', label: 'Календарь' },
          ] as const"
          :key="option.key"
          type="button"
          class="vt-btn vt-btn--sm"
          :class="view === option.key ? 'vt-btn--ink' : 'vt-btn--ghost'"
          :aria-pressed="view === option.key"
          @click="view = option.key"
        >
          {{ option.label }}
        </button>
      </div>
    </div>

    <SkeletonList v-if="loading && events.length === 0" :count="3" />
    <ErrorState v-else-if="error && events.length === 0" :message="error" @retry="loadPage(0)" />
    <template v-else>
      <p class="text-vt-mute-2" role="status">
        Загружено: {{ events.length }}{{ hasMore ? ' · доступны ещё' : '' }}.
      </p>
      <EmptyState
        v-if="events.length === 0"
        icon="calendar"
        :title="filter === 'past' ? 'Прошедших событий нет' : 'Событий пока нет'"
      >
        <template #action>
          <NuxtLink :to="`${base}/events/new`" class="vt-btn vt-btn--primary"
            >Создать событие</NuxtLink
          >
        </template>
      </EmptyState>
      <ul v-else-if="view === 'list'" class="vt-desktop-events__list">
        <li v-for="event in events" :key="event.id">
          <EventCard :event="event" :tz="tz" :to="`${base}/events/${event.id}`" />
        </li>
      </ul>
      <DesktopEventCalendar v-else :events="events" :time-zone="tz" :base="base" />
      <ErrorState v-if="error && events.length" :message="error" @retry="loadPage(events.length)" />
      <button
        v-if="hasMore"
        type="button"
        class="vt-btn vt-btn--ghost"
        :disabled="loading"
        @click="loadPage(events.length)"
      >
        {{ loading ? 'Загружаем…' : 'Загрузить ещё' }}
      </button>
    </template>
  </div>
</template>
