<script setup lang="ts">
import { DEFAULT_TIMEZONE } from '@volley-time/shared'

import { monthOfInstant, shiftMonth } from '~/utils/desktop-calendar'
import { scheduleMonthRange, scheduleMonthTitle } from '~/utils/group-schedule'
import {
  buildMyCalendar,
  calendarClashDays,
  calendarDayTitle,
  calendarMonthCells,
  calendarToday,
  defaultCalendarDay,
  groupColors,
  myCalendarSubtitle,
  type MyCalendarEvent,
  type MyCalendarFilter,
  type MyCalendarGroup,
} from '~/utils/my-calendar'

definePageMeta({ layout: 'miniapp-org', middleware: ['auth'] })

/**
 * Мой календарь (23.2.2, M-10): игры всех групп игрока одним запросом `GET /api/me/calendar`.
 * Страница живёт под маршрутом текущей группы, потому что вкладка таб-бара — `${base}/calendar`.
 * Выключенный флаг `cal` (23.1.1) скрывает вкладку, а прямой адрес ведёт на главную группы.
 */
const route = useRoute()
const orgId = computed(() => Number(route.params.orgId))

const { data: featuresData } = await useFetch<{ features: { cal: boolean } }>('/api/me/features', {
  key: 'me-features',
})
const calendarOn = computed(() => featuresData.value?.features?.cal !== false)
if (!calendarOn.value) await navigateTo(`/m/orgs/${orgId.value}`, { replace: true })

const now = ref(new Date())
const month = ref(monthOfInstant(now.value, DEFAULT_TIMEZONE))
const view = ref<'list' | 'month'>('list')
const filter = ref<MyCalendarFilter>('mine')
const groupId = ref<number | null>(null)
const pickedDay = ref<string | null>(null)

const groups = ref<MyCalendarGroup[]>([])
const events = ref<MyCalendarEvent[]>([])
const loading = ref(false)
const error = ref('')
const loadedMonth = ref<string | null>(null)
let requestSequence = 0

async function load() {
  const requestId = ++requestSequence
  const requestedMonth = month.value
  loading.value = true
  error.value = ''
  try {
    const data = await $fetch<{ groups: MyCalendarGroup[]; events: MyCalendarEvent[] }>(
      '/api/me/calendar',
      { query: scheduleMonthRange(requestedMonth) },
    )
    if (requestId !== requestSequence || requestedMonth !== month.value) return
    groups.value = data.groups
    events.value = data.events
    loadedMonth.value = requestedMonth
    // выбранная группа могла выйти из списка (вышли из группы с другого устройства)
    if (groupId.value !== null && !data.groups.some((g) => g.id === groupId.value))
      groupId.value = null
  } catch (e) {
    if (requestId !== requestSequence || requestedMonth !== month.value) return
    error.value = apiErrorMessage(e, 'Не удалось загрузить календарь')
  } finally {
    if (requestId === requestSequence) loading.value = false
  }
}

const loaded = computed(() => loadedMonth.value === month.value)
const monthItems = computed(() =>
  loaded.value
    ? buildMyCalendar(events.value, groups.value, {
        filter: filter.value,
        groupId: groupId.value,
        now: now.value,
      })
    : [],
)
const today = computed(() => calendarToday(groups.value, now.value))
const cells = computed(() => calendarMonthCells(month.value, monthItems.value))
const selectedDay = computed(() => {
  const picked = pickedDay.value
  if (picked && cells.value.some((c) => c.day === picked && c.inMonth)) return picked
  return defaultCalendarDay(cells.value, today.value)
})
const dayItems = computed(() => cells.value.find((c) => c.day === selectedDay.value)?.items ?? [])
const listDays = computed(() => cells.value.filter((c) => c.inMonth && c.items.length > 0))
const clashDays = computed(() => calendarClashDays(monthItems.value))
const colors = computed(() => groupColors(groups.value))
const subtitle = computed(() =>
  loaded.value && groups.value.length
    ? myCalendarSubtitle(groups.value, events.value, month.value)
    : undefined,
)
const monthTitle = computed(() => scheduleMonthTitle(month.value))
const weekdays = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']
const viewOptions = [
  { value: 'list', label: 'Список' },
  { value: 'month', label: 'Месяц' },
]
const filterOptions = [
  { value: 'mine', label: 'Только мои' },
  { value: 'seats', label: 'С местами' },
]
const dayAria = (day: string, count: number) =>
  count
    ? `${calendarDayTitle(day, today.value)}, игр: ${count}`
    : calendarDayTitle(day, today.value)
const emptyTitle = computed(() =>
  groupId.value !== null ? 'В этой группе нет игр' : 'Нет записей в этом месяце',
)
const emptyHint = computed(() =>
  filter.value === 'mine' ? 'Включите «С местами» — покажем игры, куда можно записаться' : '',
)

function shift(delta: number) {
  month.value = shiftMonth(month.value, delta)
  pickedDay.value = null
}
function openClash() {
  view.value = 'month'
  pickedDay.value = clashDays.value[0] ?? null
}

await load()
watch(month, load)
</script>

<template>
  <div v-if="calendarOn" class="min-h-screen pb-20">
    <VtMiniHeader title="Мой календарь" :sub="subtitle" />

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
        <h2 class="mycal-month-title" aria-live="polite">{{ monthTitle }}</h2>
        <button
          type="button"
          class="vt-btn vt-btn--ghost vt-hit-44"
          aria-label="Следующий месяц"
          @click="shift(1)"
        >
          <VtIcon name="chevron-r" :size="18" />
        </button>
      </div>

      <VtSegment v-model="view" class="mycal-seg" label="Вид календаря" :options="viewOptions" />
      <div v-if="groups.length > 1" class="mycal-groups" role="group" aria-label="Группа">
        <button
          type="button"
          class="vt-chip mycal-group"
          :class="{ 'mycal-group--on': groupId === null }"
          :aria-pressed="groupId === null"
          @click="groupId = null"
        >
          Все
        </button>
        <button
          v-for="g in groups"
          :key="g.id"
          type="button"
          class="vt-chip mycal-group"
          :class="{ 'mycal-group--on': groupId === g.id }"
          :aria-pressed="groupId === g.id"
          @click="groupId = g.id"
        >
          <i class="mycal-dot mycal-dot--lg" :style="{ '--dot': colors.get(g.id) }" />
          <span class="mycal-group__name">{{ g.name }}</span>
        </button>
      </div>
      <VtSegment
        v-model="filter"
        variant="chips"
        class="mt-2.5"
        label="Какие игры показывать"
        :options="filterOptions"
      />
    </div>

    <main class="px-4 pb-4">
      <SkeletonList v-if="loading && !loaded" :count="3" class="mt-4" />
      <ErrorState v-else-if="error" :message="error" @retry="load" />
      <template v-else>
        <button v-if="clashDays.length" type="button" class="mycal-clash mt-3" @click="openClash">
          <VtIcon name="clock" :size="18" />
          <span class="flex-1 text-[13px] leading-snug">
            <b>{{ calendarDayTitle(clashDays[0]!, today) }}: две записи пересекаются</b><br />
            Откройте игру и выберите, на какую идти
          </span>
          <VtIcon name="chevron-r" :size="16" :stroke-width="2.2" />
        </button>

        <template v-if="view === 'list'">
          <section v-for="d in listDays" :key="d.day" class="mt-4">
            <div class="vt-cap" :class="d.day === today ? 'mycal-today-cap' : 'text-vt-mute-2'">
              {{ calendarDayTitle(d.day, today) }}
            </div>
            <ul class="mycal-list">
              <li v-for="item in d.items" :key="item.event.id">
                <MyCalendarRow :item="item" />
              </li>
            </ul>
          </section>
          <EmptyState
            v-if="listDays.length === 0 && !loading"
            icon="calendar"
            :title="emptyTitle"
            :description="emptyHint"
          />
        </template>

        <template v-else>
          <div class="mycal-grid mt-4" role="grid" aria-label="Календарь месяца">
            <div v-for="d in weekdays" :key="d" class="vt-cap mycal-dow" role="columnheader">
              {{ d }}
            </div>
            <template v-for="cell in cells" :key="cell.day">
              <div v-if="!cell.inMonth" aria-hidden="true" />
              <button
                v-else
                type="button"
                class="mycal-day"
                :class="{
                  'mycal-day--has': cell.items.length,
                  'mycal-day--sel': cell.day === selectedDay,
                  'mycal-day--past': cell.day < today,
                }"
                :aria-pressed="cell.day === selectedDay"
                :aria-label="dayAria(cell.day, cell.items.length)"
                @click="pickedDay = cell.day"
              >
                <span
                  class="vt-mono mycal-day__n"
                  :class="{ 'mycal-day__n--today': cell.day === today }"
                  >{{ cell.number }}</span
                >
                <span v-if="cell.items.length" class="mycal-dots" aria-hidden="true">
                  <i
                    v-for="item in cell.items"
                    :key="item.event.id"
                    class="mycal-dot"
                    :class="{ 'mycal-dot--ring': item.participation !== 'going' }"
                    :style="{ '--dot': item.color }"
                  />
                </span>
                <i
                  v-if="cell.items.some((i) => i.clash)"
                  class="mycal-clash-dot"
                  aria-hidden="true"
                />
              </button>
            </template>
          </div>
          <div class="mycal-legend mt-3">
            <span v-for="g in groups" :key="g.id"
              ><i class="mycal-dot" :style="{ '--dot': colors.get(g.id) }" />{{ g.name }}</span
            >
            <span
              ><i class="mycal-dot mycal-dot--ring" style="--dot: var(--vt-mute-2)" />очередь</span
            >
          </div>
          <div class="vt-cap mt-5 text-vt-mute-2">
            {{ selectedDay ? calendarDayTitle(selectedDay, today) : 'Нет игр' }}
          </div>
          <ul v-if="dayItems.length" class="mycal-list">
            <li v-for="item in dayItems" :key="item.event.id">
              <MyCalendarRow :item="item" />
            </li>
          </ul>
          <p v-else class="py-4 text-sm text-vt-mute-2">
            {{ monthItems.length ? 'Игр нет' : emptyTitle }}
          </p>
        </template>
      </template>
    </main>
  </div>
</template>

<style scoped>
.mycal-month-title {
  font-size: var(--fs-2xl);
}
.mycal-seg {
  display: flex;
  margin-top: 12px;
}
.mycal-seg :deep(.vt-seg__item) {
  flex: 1;
}
.mycal-groups {
  display: flex;
  gap: 6px;
  margin-top: 10px;
  overflow-x: auto;
  scrollbar-width: none;
}
.mycal-group {
  flex-shrink: 0;
  min-height: 36px;
  padding: 8px 12px;
  gap: 6px;
  font-size: var(--fs-sm);
  cursor: pointer;
  background: var(--vt-ctl-chip);
  color: var(--vt-ink);
}
.mycal-group--on {
  background: var(--vt-ink);
  color: var(--vt-paper);
}
.mycal-group__name {
  max-width: 160px;
  overflow: hidden;
  text-overflow: ellipsis;
}
.mycal-dot {
  display: block;
  width: 6px;
  height: 6px;
  flex-shrink: 0;
  border-radius: 50%;
  background: var(--dot);
}
.mycal-dot--lg {
  width: 8px;
  height: 8px;
}
.mycal-dot--ring {
  background: transparent;
  box-shadow: inset 0 0 0 1.5px var(--dot);
}
.mycal-clash {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 12px 14px;
  border-radius: var(--r-btn);
  background: var(--vt-amber-soft);
  color: var(--vt-amber-ink);
  text-align: left;
  cursor: pointer;
}
.mycal-today-cap {
  color: var(--vt-flame-deep);
}
.mycal-list > li + li {
  box-shadow: inset 0 1px 0 var(--vt-bone-2);
}
.mycal-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 4px;
}
.mycal-dow {
  text-align: center;
  color: var(--vt-mute-2);
  padding-bottom: 4px;
}
.mycal-day {
  position: relative;
  height: 48px;
  border-radius: var(--r-field);
  background: transparent;
  color: var(--vt-ink);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 5px;
  cursor: pointer;
}
.mycal-day--has {
  background: var(--vt-ctl);
}
.mycal-day--past {
  color: var(--vt-mute);
}
.mycal-day--sel {
  box-shadow: inset 0 0 0 2px var(--vt-ink);
}
.mycal-day__n {
  font-size: var(--fs-md);
  font-weight: 700;
  line-height: 1;
}
.mycal-day__n--today {
  font-weight: 800;
  color: var(--vt-flame-deep);
}
.mycal-dots {
  display: flex;
  gap: 3px;
}
.mycal-clash-dot {
  position: absolute;
  top: 5px;
  right: 5px;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--vt-amber);
}
.mycal-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  font-size: var(--fs-xs);
  color: var(--vt-mute-2);
}
.mycal-legend span {
  display: flex;
  align-items: center;
  gap: 5px;
}
.mycal-legend .mycal-dot {
  width: 7px;
  height: 7px;
}
</style>

<style>
/* Тёмная тема: «сегодня» — на тёмном фоне светлее, как в расписании группы. */
:is(.dark, .vt-dark) .mycal-day__n--today,
:is(.dark, .vt-dark) .mycal-today-cap {
  color: var(--vt-link);
}
</style>
