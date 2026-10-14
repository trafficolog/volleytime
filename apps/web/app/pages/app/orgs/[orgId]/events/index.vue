<script setup lang="ts">
import type { EventListItem } from '~/components/EventCard.vue'
import {
  appendDesktopEventPage,
  buildMonthGrid,
  eventFilterQuery,
  monthOfInstant,
  type EventFilterKey,
} from '~/utils/desktop-calendar'

definePageMeta({ layout: 'desktop-org', middleware: ['auth'] })

const route = useRoute()
const orgId = computed(() => Number(route.params.orgId))
const base = computed(() => `/app/orgs/${orgId.value}`)
const { tz } = useOrgTimezone(orgId)
const filter = ref<EventFilterKey>('all')
const view = ref<'list' | 'calendar'>('list')
const viewOptions = [
  { value: 'list', label: 'Список' },
  { value: 'calendar', label: 'Календарь' },
]
const filterOptions = [
  { value: 'all', label: 'Все' },
  { value: 'open', label: 'Открыта запись' },
  { value: 'past', label: 'Прошедшие' },
  { value: 'cancelled', label: 'Отменённые' },
]
const month = ref(monthOfInstant(new Date(), tz.value))
const events = ref<EventListItem[]>([])
const calendarEvents = ref<EventListItem[]>([])
const calendarLoading = ref(false)
const calendarError = ref('')
let calendarGeneration = 0
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
      { query: { ...eventFilterQuery(targetFilter), limit: 50, offset } },
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

/** Календарь грузит выбранный месяц целиком (диапазон from/to), а не страницу списка. */
async function loadCalendar() {
  const token = ++calendarGeneration
  const targetOrgId = orgId.value
  const grid = buildMonthGrid(month.value, [])
  calendarLoading.value = true
  calendarError.value = ''
  try {
    const result = await $fetch<{ events: EventListItem[] }>(
      `/api/organizations/${targetOrgId}/events`,
      {
        query: {
          ...eventFilterQuery(filter.value),
          from: grid[0]!.day,
          to: grid[grid.length - 1]!.day,
        },
      },
    )
    if (token !== calendarGeneration) return
    calendarEvents.value = result.events
  } catch (cause) {
    if (token !== calendarGeneration) return
    calendarError.value = apiErrorMessage(cause, 'Не удалось загрузить события')
  } finally {
    if (token === calendarGeneration) calendarLoading.value = false
  }
}

const emptyTitle = computed(() =>
  filter.value === 'past'
    ? 'Прошедших событий нет'
    : filter.value === 'cancelled'
      ? 'Отменённых событий нет'
      : 'Событий пока нет',
)

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
watch(orgId, () => {
  calendarEvents.value = []
})
// Сетка не очищается на время перезагрузки: старые данные остаются до прихода новых.
watch(
  [orgId, filter, month, view],
  () => {
    if (view.value === 'calendar') void loadCalendar()
    else calendarGeneration++
  },
  { immediate: true },
)
onBeforeUnmount(() => {
  generation++
  calendarGeneration++
})
</script>

<template>
  <div class="vt-desktop-events space-y-6">
    <header class="vt-desktop-dashboard__heading">
      <div>
        <p class="vt-cap">Управление группой</p>
        <h1 tabindex="-1">События</h1>
        <p class="text-vt-mute-2">Все тренировки и игры организации</p>
      </div>
      <div class="vt-desktop-events__filters">
        <VtSegment v-model="view" label="Вид событий" :options="viewOptions" />
        <NuxtLink :to="`${base}/events/new`" class="vt-btn vt-btn--primary vt-btn--sm">
          <VtIcon name="plus" :size="14" /> Создать
        </NuxtLink>
      </div>
    </header>

    <VtSegment v-model="filter" label="Фильтр событий" variant="chips" :options="filterOptions" />

    <DesktopEventCalendar
      v-if="view === 'calendar'"
      v-model:month="month"
      :events="calendarEvents"
      :time-zone="tz"
      :base="base"
      :loading="calendarLoading"
      :error="calendarError"
      @retry="loadCalendar"
    />
    <template v-else>
      <SkeletonList v-if="loading && events.length === 0" :count="3" />
      <ErrorState v-else-if="error && events.length === 0" :message="error" @retry="loadPage(0)" />
      <template v-else>
        <p class="text-vt-mute-2" role="status">
          Загружено: {{ events.length }}{{ hasMore ? ' · доступны ещё' : '' }}.
        </p>
        <EmptyState v-if="events.length === 0" icon="calendar" :title="emptyTitle">
          <template #action>
            <NuxtLink :to="`${base}/events/new`" class="vt-btn vt-btn--primary"
              >Создать событие</NuxtLink
            >
          </template>
        </EmptyState>
        <DesktopEventTable v-else :events="events" :time-zone="tz" :base="base" />
        <ErrorState
          v-if="error && events.length"
          :message="error"
          @retry="loadPage(events.length)"
        />
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
    </template>
  </div>
</template>
