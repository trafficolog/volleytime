<script setup lang="ts">
import type { OrganizationMember } from '@volley-time/db'

import type { EventListItem } from '~/components/EventCard.vue'
import { buildMonthGrid, monthOfInstant, shiftMonth } from '~/utils/desktop-calendar'
import {
  firstEventDay,
  groupScheduleWeeks,
  isMineEvent,
  scheduleDayTitle,
  scheduleDot,
  scheduleMonthRange,
  scheduleMonthTitle,
  scheduleSubtitle,
} from '~/utils/group-schedule'
import { playerAccessFromApiError } from '~/utils/player-home'
definePageMeta({ layout: 'miniapp-org', middleware: ['auth'] })

/** Расписание группы на месяц (21.1.4, M-11): календарь / список по неделям, у игрока фильтр «Мои». */
const route = useRoute()
const orgId = computed(() => Number(route.params.orgId))
const { tz } = useOrgTimezone(orgId)

const { data: orgData, error: orgError } = await useFetch<{
  organization: { id: number; defaultTimezone?: string }
  myMember: OrganizationMember
}>(() => `/api/organizations/${orgId.value}`, { key: () => `org-events-access-${orgId.value}` })
const isManager = computed(() => {
  if (orgError.value || orgData.value?.organization.id !== orgId.value) return false
  const m = orgData.value?.myMember
  return !!m && m.status === 'active' && ['owner', 'organizer'].includes(m.role)
})
const role = computed(() => (isManager.value ? 'org' : 'player'))

// Месяц — по часовому поясу группы из уже загруженной организации, а не по запасному поясу.
const month = ref(
  monthOfInstant(new Date(), orgData.value?.organization.defaultTimezone ?? tz.value),
)
const view = ref<'cal' | 'list'>('cal')
const onlyMine = ref(false)
const pickedDay = ref<string | null>(null)
const events = ref<EventListItem[]>([])
const loading = ref(false)
const error = ref('')
const accessNotice = ref<ReturnType<typeof playerAccessFromApiError>>(null)
const canCreate = computed(() => isManager.value && !loading.value && !error.value)
const loadedOrgId = ref<number | null>(null)
const loadedMonth = ref<string | null>(null)
const monthEvents = computed(() =>
  loadedOrgId.value === orgId.value && loadedMonth.value === month.value ? events.value : [],
)
const shownEvents = computed(() =>
  onlyMine.value && !isManager.value ? monthEvents.value.filter(isMineEvent) : monthEvents.value,
)
const grid = computed(() => buildMonthGrid(month.value, shownEvents.value, tz.value))
const weeks = computed(() => groupScheduleWeeks(month.value, shownEvents.value, tz.value))
const selectedDay = computed(() => {
  const picked = pickedDay.value
  if (picked && grid.value.some((c) => c.day === picked && c.events.length)) return picked
  return firstEventDay(month.value, shownEvents.value, tz.value)
})
const dayEvents = computed(() => grid.value.find((c) => c.day === selectedDay.value)?.events ?? [])
const subtitle = computed(() => scheduleSubtitle(monthEvents.value, role.value))
const monthTitle = computed(() => scheduleMonthTitle(month.value))
const weekdays = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']
const viewOptions = [
  { value: 'cal', label: 'Календарь' },
  { value: 'list', label: 'Список' },
]
const eventLink = (ev: EventListItem) =>
  isManager.value
    ? `/m/orgs/${orgId.value}/events/${ev.id}/manage`
    : `/m/orgs/${orgId.value}/events/${ev.id}`
let requestSequence = 0

async function load() {
  const requestId = ++requestSequence
  const requestedOrgId = orgId.value
  const requestedMonth = month.value
  loading.value = true
  error.value = ''
  accessNotice.value = null
  events.value = []
  loadedOrgId.value = null
  loadedMonth.value = null
  try {
    const data = await $fetch<{ events: EventListItem[] }>(
      `/api/organizations/${requestedOrgId}/events`,
      { query: { filter: 'all', ...scheduleMonthRange(requestedMonth) } },
    )
    if (
      requestId !== requestSequence ||
      requestedOrgId !== orgId.value ||
      requestedMonth !== month.value
    )
      return
    events.value = data.events
    loadedOrgId.value = requestedOrgId
    loadedMonth.value = requestedMonth
  } catch (e) {
    if (
      requestId !== requestSequence ||
      requestedOrgId !== orgId.value ||
      requestedMonth !== month.value
    )
      return
    error.value = apiErrorMessage(e, 'Не удалось загрузить события')
    accessNotice.value = playerAccessFromApiError(apiErrorCode(e))
  } finally {
    if (requestId === requestSequence) loading.value = false
  }
}

function shift(delta: number) {
  month.value = shiftMonth(month.value, delta)
  pickedDay.value = null
}
function toggleMine() {
  onlyMine.value = !onlyMine.value
  pickedDay.value = null
}
await load()
watch([orgId, month], load)
</script>

<template>
  <div class="min-h-screen pb-20">
    <VtMiniHeader
      title="Расписание"
      :sub="loadedMonth ? subtitle : undefined"
      :back="`/m/orgs/${orgId}`"
    >
      <template v-if="isManager" #right>
        <button
          type="button"
          class="organizer-create-link vt-btn vt-btn--ghost vt-hit-44"
          aria-label="Создать событие"
          :disabled="!canCreate"
          @click="canCreate && navigateTo(`/m/orgs/${orgId}/events/new`)"
        >
          <VtIcon name="plus" :size="18" />
        </button>
      </template>
    </VtMiniHeader>

    <div class="px-4 pt-2">
      <div class="flex items-center justify-between">
        <button
          type="button"
          class="vt-btn vt-btn--ghost vt-hit-44"
          aria-label="Предыдущий месяц"
          @click="shift(-1)"
        >
          <VtIcon name="chevron-l" :size="18" />
        </button>
        <h2 class="schedule-month-title" aria-live="polite">{{ monthTitle }}</h2>
        <button
          type="button"
          class="vt-btn vt-btn--ghost vt-hit-44"
          aria-label="Следующий месяц"
          @click="shift(1)"
        >
          <VtIcon name="chevron-r" :size="18" />
        </button>
      </div>

      <div class="mt-3 flex gap-2">
        <VtSegment
          v-model="view"
          class="schedule-view"
          label="Вид расписания"
          :options="viewOptions"
        />
        <button
          v-if="!isManager"
          type="button"
          class="schedule-mine vt-btn vt-btn--sm"
          :class="{ 'schedule-mine--on': onlyMine }"
          :aria-pressed="onlyMine"
          @click="toggleMine"
        >
          <VtIcon name="check" :size="13" :stroke-width="2.4" />Мои
        </button>
      </div>
    </div>

    <main class="px-4 pb-4">
      <SkeletonList v-if="loading" :count="3" class="mt-4" />
      <PlayerAccessNotice v-else-if="accessNotice" :access="accessNotice" />
      <ErrorState v-else-if="error" :message="error" @retry="load" />
      <template v-else-if="view === 'cal'">
        <div class="schedule-grid mt-4" role="grid" aria-label="Календарь месяца">
          <div v-for="d in weekdays" :key="d" class="vt-cap schedule-dow" role="columnheader">
            {{ d }}
          </div>
          <template v-for="cell in grid" :key="cell.day">
            <div v-if="!cell.inMonth" aria-hidden="true" />
            <button
              v-else
              type="button"
              class="schedule-day"
              :class="{
                'schedule-day--has': cell.events.length,
                'schedule-day--sel': cell.day === selectedDay,
              }"
              :disabled="!cell.events.length"
              :aria-pressed="cell.day === selectedDay"
              :aria-label="
                cell.events.length
                  ? `${scheduleDayTitle(cell.day)}, тренировок: ${cell.events.length}`
                  : scheduleDayTitle(cell.day)
              "
              @click="pickedDay = cell.day"
            >
              <span class="vt-mono schedule-day__n">{{ cell.number }}</span>
              <span v-if="cell.events.length" class="schedule-dots" aria-hidden="true">
                <i
                  v-for="e in cell.events"
                  :key="e.id"
                  class="schedule-dot"
                  :class="`schedule-dot--${scheduleDot(e)}`"
                />
              </span>
            </button>
          </template>
        </div>
        <div class="schedule-legend mt-3">
          <span><i class="schedule-dot schedule-dot--going" />вы идёте</span>
          <span><i class="schedule-dot schedule-dot--queue" />в очереди</span>
          <span><i class="schedule-dot schedule-dot--plain" />тренировка</span>
        </div>
        <div class="vt-cap mt-5 text-vt-mute-2">
          {{ selectedDay ? scheduleDayTitle(selectedDay) : 'Нет тренировок' }}
        </div>
        <ul
          class="mt-0.5"
          :class="isManager ? 'divide-y divide-[var(--vt-stroke)]' : 'player-schedule'"
        >
          <li v-for="ev in dayEvents" :key="ev.id">
            <OrganizerEventRow v-if="isManager" :event="ev" :tz="tz" :to="eventLink(ev)" />
            <EventCard v-else :event="ev" :tz="tz" :to="eventLink(ev)" presentation="schedule" />
          </li>
        </ul>
      </template>
      <template v-else>
        <section v-for="w in weeks" :key="w.label" class="mt-4">
          <div class="vt-cap text-vt-mute-2">{{ w.label }}</div>
          <ul :class="isManager ? 'divide-y divide-[var(--vt-stroke)]' : 'player-schedule'">
            <li v-for="ev in w.events" :key="ev.id">
              <OrganizerEventRow v-if="isManager" :event="ev" :tz="tz" :to="eventLink(ev)" />
              <EventCard v-else :event="ev" :tz="tz" :to="eventLink(ev)" presentation="schedule" />
            </li>
          </ul>
        </section>
        <EmptyState
          v-if="weeks.length === 0"
          icon="calendar"
          :title="onlyMine ? 'В этом месяце у вас нет записей' : 'В этом месяце тренировок нет'"
          :description="canCreate ? 'Создайте тренировку — игроки увидят её здесь' : ''"
        >
          <template v-if="canCreate" #action>
            <NuxtLink :to="`/m/orgs/${orgId}/events/new`" class="vt-btn vt-btn--primary">
              Создать событие
            </NuxtLink>
          </template>
        </EmptyState>
      </template>
    </main>
  </div>
</template>

<style scoped>
.schedule-month-title {
  font-size: var(--fs-2xl);
}
.schedule-view {
  display: flex;
  flex: 1;
}
.schedule-view :deep(.vt-seg__item) {
  flex: 1;
}
.schedule-mine {
  gap: 6px;
  background: var(--vt-ctl);
  color: var(--vt-ink);
}
.schedule-mine--on {
  background: var(--vt-blue-ink);
  color: var(--vt-on-hero);
}
.schedule-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 4px;
}
.schedule-dow {
  text-align: center;
  color: var(--vt-mute-2);
  padding-bottom: 4px;
}
.schedule-day {
  height: 48px;
  border-radius: var(--r-field);
  background: transparent;
  color: var(--vt-mute);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  cursor: default;
}
.schedule-day--has {
  background: var(--vt-ctl);
  color: var(--vt-ink);
  cursor: pointer;
}
.schedule-day--sel {
  background: var(--vt-ink);
  color: var(--vt-paper);
}
.schedule-day__n {
  font-size: var(--fs-md);
  font-weight: 700;
  line-height: 1;
}
.schedule-dots {
  display: flex;
  gap: 4px;
}
.schedule-dot {
  display: block;
  width: 6px;
  height: 6px;
  border-radius: var(--r-pill);
  box-shadow: inset 0 0 0 1.5px var(--vt-icon-idle);
}
.schedule-dot--going {
  background: var(--vt-blue-ink);
  box-shadow: none;
}
.schedule-dot--queue {
  box-shadow: inset 0 0 0 1.5px var(--vt-flame-ink);
}
.schedule-dot--muted {
  opacity: 0.4;
}
.schedule-day--sel .schedule-dot {
  box-shadow: inset 0 0 0 1.5px var(--vt-on-hero-3);
}
.schedule-day--sel .schedule-dot--going {
  background: var(--vt-on-hero);
  box-shadow: none;
}
.schedule-legend {
  display: flex;
  gap: 14px;
  font-size: var(--fs-xs);
  color: var(--vt-mute-2);
}
.schedule-legend span {
  display: flex;
  align-items: center;
  gap: 6px;
}
.schedule-legend .schedule-dot {
  width: 7px;
  height: 7px;
}
</style>

<style>
/* Тёмная тема: «вы идёте» — flame, как чип участия; выбранный день светлый. */
:is(.dark, .vt-dark) .schedule-dot--going,
:is(.dark, .vt-dark) .schedule-legend .schedule-dot--going {
  background: var(--vt-flame);
}
:is(.dark, .vt-dark) .schedule-mine--on {
  background: var(--vt-flame);
}
:is(.dark, .vt-dark) .schedule-grid .schedule-day--sel .schedule-dot {
  box-shadow: inset 0 0 0 1.5px var(--vt-icon-idle);
}
:is(.dark, .vt-dark) .schedule-grid .schedule-day--sel .schedule-dot--going {
  background: var(--vt-blue-ink);
  box-shadow: none;
}
</style>
