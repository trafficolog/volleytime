<script setup lang="ts">
import { formatDay, formatTime } from '@volley-time/shared'

import type { EventListItem } from './EventCard.vue'

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
      <div class="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <VtStateChip class="organizer-event-status" :event="event" />
        <VtSeatsMini :taken="event.taken" :capacity="event.capacity" :event="event" :width="96" />
      </div>
    </div>
  </NuxtLink>
</template>
