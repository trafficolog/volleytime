<script setup lang="ts">
import { formatDay, formatTime } from '@volley-time/shared'

import type { EventListItem } from './EventCard.vue'

import { EVENT_STATUS_LABELS, label } from '~/utils/labels'

const props = defineProps<{ event: EventListItem; tz: string; to: string }>()
const dateParts = computed(() =>
  new Intl.DateTimeFormat('ru-RU', { timeZone: props.tz, day: 'numeric', weekday: 'short' })
    .formatToParts(new Date(props.event.startsAt))
    .filter((part) => part.type === 'day' || part.type === 'weekday'),
)
const dayNumber = computed(() => dateParts.value.find((part) => part.type === 'day')?.value ?? '')
const weekday = computed(() => dateParts.value.find((part) => part.type === 'weekday')?.value ?? '')
const venue = computed(() => props.event.venue?.name ?? props.event.locationText)
</script>

<template>
  <NuxtLink :to="to" class="organizer-event-row flex min-h-20 items-center gap-3 py-3">
    <div class="w-10 shrink-0 text-center" :aria-label="formatDay(event.startsAt, tz)">
      <div class="vt-mono text-2xl font-bold leading-none" aria-hidden="true">{{ dayNumber }}</div>
      <div class="vt-cap mt-1 text-vt-mute-2" aria-hidden="true">{{ weekday }}</div>
    </div>
    <div class="min-w-0 flex-1">
      <div class="font-bold leading-snug break-words">{{ event.title }}</div>
      <div class="mt-1 text-xs text-vt-mute-2 break-words">
        {{ formatDay(event.startsAt, tz) }} · {{ formatTime(event.startsAt, tz)
        }}<template v-if="venue"> · {{ venue }}</template>
      </div>
      <div class="mt-2 flex items-center gap-2">
        <VtMeter
          class="min-w-0 max-w-30 flex-1"
          :value="event.taken"
          :max="event.capacity"
          :tone="event.taken >= event.capacity ? 'amber' : 'flame'"
          :label="`Занято ${event.taken} из ${event.capacity}`"
        />
        <span class="vt-mono text-xs whitespace-nowrap"
          >{{ event.taken }}/{{ event.capacity }}</span
        >
      </div>
    </div>
    <VtChip
      class="organizer-event-status max-w-full shrink-0 text-center whitespace-normal break-words"
      :tone="
        event.status === 'draft' ? 'amber' : event.status === 'published' ? 'grass' : 'default'
      "
    >
      {{ event.status === 'published' ? 'Опубликовано' : label(EVENT_STATUS_LABELS, event.status) }}
    </VtChip>
  </NuxtLink>
</template>

<style scoped>
@media (max-width: 390px) {
  .organizer-event-row {
    display: grid;
    grid-template-columns: 40px minmax(0, 1fr);
    align-items: start;
    gap: 8px;
  }

  .organizer-event-status {
    grid-column: 2;
    justify-self: start;
    max-width: 100%;
  }
}
</style>
