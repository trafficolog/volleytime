<script setup lang="ts">
import { formatTime } from '@volley-time/shared'

import type { EventListItem } from '~/components/EventCard.vue'
import { groupEventsByOrgDay } from '~/utils/desktop-calendar'

const props = defineProps<{ events: EventListItem[]; timeZone: string; base: string }>()

const months = computed(() => {
  const grouped = groupEventsByOrgDay(props.events, props.timeZone)
  const byMonth = new Map<string, Map<string, EventListItem[]>>()
  for (const [day, items] of grouped) {
    const month = day.slice(0, 7)
    const days = byMonth.get(month) ?? new Map<string, EventListItem[]>()
    days.set(day, items)
    byMonth.set(month, days)
  }
  return [...byMonth].map(([key, days]) => {
    const [year, month] = key.split('-').map(Number)
    const first = new Date(Date.UTC(year!, month! - 1, 1))
    const padding = (first.getUTCDay() + 6) % 7
    const length = new Date(Date.UTC(year!, month!, 0)).getUTCDate()
    const label = new Intl.DateTimeFormat('ru-RU', {
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(first)
    return {
      key,
      label,
      cells: [
        ...Array.from({ length: padding }, () => null),
        ...Array.from({ length }, (_, index) => {
          const day = `${key}-${String(index + 1).padStart(2, '0')}`
          return { day, number: index + 1, events: days.get(day) ?? [] }
        }),
      ],
    }
  })
})
</script>

<template>
  <div class="space-y-5">
    <p class="text-vt-mute-2" role="status">
      Календарь показывает только загруженные события. Подгрузите следующую страницу, чтобы увидеть
      больше дат.
    </p>
    <section v-for="month in months" :key="month.key" class="vt-card vt-desktop-calendar">
      <h2>{{ month.label }}</h2>
      <div class="vt-desktop-calendar__grid">
        <div v-for="day in ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']" :key="day">
          {{ day }}
        </div>
        <div
          v-for="(cell, index) in month.cells"
          :key="cell?.day ?? `blank-${index}`"
          class="vt-desktop-calendar__day"
        >
          <template v-if="cell">
            <span class="vt-mono">{{ cell.number }}</span>
            <ul v-if="cell.events.length">
              <li v-for="event in cell.events" :key="event.id">
                <NuxtLink :to="`${base}/events/${event.id}`">
                  {{ formatTime(event.startsAt, timeZone) }} {{ event.title }}
                </NuxtLink>
              </li>
            </ul>
          </template>
        </div>
      </div>
    </section>
  </div>
</template>
