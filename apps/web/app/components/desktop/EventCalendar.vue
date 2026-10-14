<script setup lang="ts">
import { formatTime } from '@volley-time/shared'

import type { EventListItem } from '~/components/EventCard.vue'
import {
  buildMonthGrid,
  monthOfInstant,
  shiftMonth,
  type MonthCell,
} from '~/utils/desktop-calendar'
import { eventStateOf, meterTint, seatsOf } from '~/utils/status-model'

/** Календарь-месяц кабинета (W-03, 20.5.4): ≤2 события в ячейке, «+N ещё» → лист выбора. */
const props = defineProps<{ events: EventListItem[]; timeZone: string; base: string }>()

const MAX_PILLS = 2
const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']
const month = ref(monthOfInstant(new Date(), props.timeZone))
const picked = ref<MonthCell | null>(null)
const pickerOpen = ref(false)

const grid = computed(() => buildMonthGrid(month.value, props.events, props.timeZone))
const label = computed(() => {
  const [year, m] = month.value.split('-').map(Number)
  const date = new Date(Date.UTC(year!, m! - 1, 1))
  const name = new Intl.DateTimeFormat('ru-RU', { month: 'long', timeZone: 'UTC' }).format(date)
  return `${name} ${year}`
})
const weeks = computed(() =>
  Array.from({ length: grid.value.length / 7 }, (_, i) => grid.value.slice(i * 7, i * 7 + 7)),
)
const dayLabel = (cell: MonthCell) =>
  new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', timeZone: 'UTC' }).format(
    new Date(`${cell.day}T00:00:00Z`),
  )
const eventsWord = (n: number) =>
  n % 10 === 1 && n % 100 !== 11
    ? 'событие'
    : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20)
      ? 'события'
      : 'событий'
const sheetTitle = computed(() =>
  picked.value
    ? `${dayLabel(picked.value)} · ${picked.value.events.length} ${eventsWord(picked.value.events.length)}`
    : '',
)

function seatsFor(event: EventListItem) {
  return seatsOf({ taken: event.taken, capacity: event.capacity }, eventStateOf(event))
}
const tint = (event: EventListItem) => {
  const seats = seatsFor(event)
  return seats.dim ? 'var(--vt-stroke-2)' : meterTint(seats.pct)
}
function openDay(cell: MonthCell) {
  picked.value = cell
  pickerOpen.value = true
}
</script>

<template>
  <section class="vt-card vt-desktop-calendar" aria-labelledby="vt-calendar-month">
    <header class="vt-desktop-calendar__head">
      <h2 id="vt-calendar-month" aria-live="polite">{{ label }}</h2>
      <div class="vt-desktop-calendar__nav">
        <button
          type="button"
          class="vt-btn vt-btn--ghost vt-btn--sm"
          aria-label="Предыдущий месяц"
          @click="month = shiftMonth(month, -1)"
        >
          <VtIcon name="chevron-l" :size="14" />
        </button>
        <button
          type="button"
          class="vt-btn vt-btn--ghost vt-btn--sm"
          @click="month = monthOfInstant(new Date(), timeZone)"
        >
          Сегодня
        </button>
        <button
          type="button"
          class="vt-btn vt-btn--ghost vt-btn--sm"
          aria-label="Следующий месяц"
          @click="month = shiftMonth(month, 1)"
        >
          <VtIcon name="chevron-r" :size="14" />
        </button>
      </div>
    </header>
    <table class="vt-desktop-calendar__grid" aria-label="Календарь событий">
      <thead>
        <tr>
          <th v-for="d in WEEKDAYS" :key="d" scope="col" class="vt-cap">{{ d }}</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(week, w) in weeks" :key="w">
          <td
            v-for="cell in week"
            :key="cell.day"
            class="vt-desktop-calendar__day"
            :class="{ 'is-outside': !cell.inMonth }"
            :data-day="cell.day"
          >
            <div class="vt-desktop-calendar__daynum">
              <span class="vt-mono">{{ cell.number }}</span>
              <span
                v-if="cell.events.length > 1"
                class="vt-desktop-calendar__count vt-mono"
                :aria-label="`${cell.events.length} ${eventsWord(cell.events.length)}`"
                >{{ cell.events.length }}</span
              >
            </div>
            <NuxtLink
              v-for="event in cell.events.slice(0, MAX_PILLS)"
              :key="event.id"
              :to="`${base}/events/${event.id}`"
              class="vt-desktop-calendar__pill"
              :class="{ 'is-dim': eventStateOf(event) !== null }"
              :style="{ borderInlineStartColor: tint(event) }"
            >
              <span class="vt-desktop-calendar__pill-title"
                >{{ formatTime(event.startsAt, timeZone) }} {{ event.title }}</span
              >
              <span class="vt-mono vt-desktop-calendar__pill-sub">{{ seatsFor(event).text }}</span>
            </NuxtLink>
            <button
              v-if="cell.events.length > MAX_PILLS"
              type="button"
              class="vt-desktop-calendar__more"
              :aria-label="`Ещё ${cell.events.length - MAX_PILLS}: ${dayLabel(cell)}`"
              @click="openDay(cell)"
            >
              +{{ cell.events.length - MAX_PILLS }} ещё
            </button>
          </td>
        </tr>
      </tbody>
    </table>

    <VtSheet id="vt-calendar-day-sheet" v-model="pickerOpen" :title="sheetTitle">
      <p class="vt-desktop-calendar__hint">Выберите тренировку</p>
      <ul v-if="picked" class="vt-desktop-calendar__picker">
        <li v-for="event in picked.events" :key="event.id">
          <NuxtLink :to="`${base}/events/${event.id}`" @click="pickerOpen = false">
            <span class="vt-mono">{{ formatTime(event.startsAt, timeZone) }}</span>
            <span class="vt-desktop-calendar__picker-title">{{ event.title }}</span>
            <VtStateChip :event="event" />
            <span class="vt-mono">{{ seatsFor(event).text }}</span>
          </NuxtLink>
        </li>
      </ul>
    </VtSheet>
  </section>
</template>
