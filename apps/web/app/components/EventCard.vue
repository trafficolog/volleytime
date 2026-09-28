<script setup lang="ts">
import { formatDay, formatTime } from '@volley-time/shared'

import { formatPrice } from '~/utils/labels'
import { eventCardBookingState } from '~/utils/player-event'

export interface EventListItem {
  id: number
  title: string
  status: string
  startsAt: string
  endsAt: string
  capacity: number
  price: number
  currency: string
  taken: number
  waitlist: number
  myBooking: { id: number; status: string } | null
  venue: { name: string } | null
  locationText: string | null
}

const props = withDefaults(
  defineProps<{
    event: EventListItem
    tz: string
    to: string
    presentation?: 'card' | 'schedule'
  }>(),
  { presentation: 'card' },
)
const calendarDay = computed(() =>
  new Intl.DateTimeFormat('ru-RU', { day: 'numeric', timeZone: props.tz }).format(
    new Date(props.event.startsAt),
  ),
)
const weekday = computed(() =>
  new Intl.DateTimeFormat('ru-RU', { weekday: 'short', timeZone: props.tz }).format(
    new Date(props.event.startsAt),
  ),
)
const full = computed(() => props.event.taken >= props.event.capacity)
const left = computed(() => Math.max(0, props.event.capacity - props.event.taken))
const myChip = computed(() => eventCardBookingState(props.event.myBooking?.status ?? null))
</script>

<template>
  <NuxtLink v-if="presentation === 'schedule'" :to="to" class="player-schedule-row">
    <div class="w-11 shrink-0 text-center">
      <div class="vt-mono text-[28px] leading-none">{{ calendarDay }}</div>
      <div class="text-[11px] text-vt-mute-2 mt-1">{{ weekday }}</div>
    </div>
    <div class="flex-1 min-w-0">
      <div class="font-semibold text-[15px] truncate">{{ event.title }}</div>
      <div class="text-[12.5px] text-vt-mute-2 mt-0.5 truncate">
        {{ formatTime(event.startsAt, tz) }}
        <template v-if="event.venue || event.locationText">
          · {{ event.venue?.name ?? event.locationText }}
        </template>
      </div>
      <div v-if="event.price > 0" class="text-[11px] text-vt-mute-2 mt-1">
        {{ formatPrice(event.price, event.currency) }}
      </div>
    </div>
    <VtChip v-if="myChip" :tone="myChip.tone">{{ myChip.text }}</VtChip>
    <VtChip v-else :tone="full ? 'amber' : 'grass'">{{ event.taken }}/{{ event.capacity }}</VtChip>
  </NuxtLink>
  <NuxtLink v-else :to="to" class="vt-card p-3.5 flex gap-3">
    <div class="w-14 shrink-0 text-center">
      <div class="vt-cap !text-[10px]">{{ formatDay(event.startsAt, tz).split(',')[0] }}</div>
      <div class="vt-mono font-bold text-lg leading-tight">
        {{ formatTime(event.startsAt, tz) }}
      </div>
    </div>
    <div class="flex-1 min-w-0">
      <div class="flex items-center gap-2">
        <span class="font-semibold truncate">{{ event.title }}</span>
        <VtChip v-if="event.status === 'draft'" tone="amber">Черновик</VtChip>
        <VtChip v-else-if="event.status === 'cancelled'" tone="rose">Отменено</VtChip>
      </div>
      <div class="text-[12px] text-vt-mute-2 truncate">
        {{ formatDay(event.startsAt, tz) }}
        <template v-if="event.venue || event.locationText">
          · {{ event.venue?.name ?? event.locationText }}</template
        >
      </div>
      <div class="mt-2 flex items-center gap-2">
        <VtMeter
          class="flex-1"
          :value="event.taken"
          :max="event.capacity"
          :tone="full ? 'amber' : 'flame'"
          :label="`Занято ${event.taken} из ${event.capacity}`"
        />
        <span class="vt-mono text-[11.5px] text-vt-mute-2"
          >{{ event.taken }}/{{ event.capacity }}</span
        >
      </div>
      <div class="mt-2 flex flex-wrap items-center gap-1.5">
        <VtChip v-if="myChip" :tone="myChip.tone" dot>{{ myChip.text }}</VtChip>
        <VtChip v-else-if="full" tone="rose"
          >Мест нет{{ event.waitlist ? ` · ожидают ${event.waitlist}` : '' }}</VtChip
        >
        <span v-else class="text-[11.5px] text-vt-mute-2">осталось {{ left }}</span>
        <span class="ml-auto text-[12px] font-semibold">{{
          formatPrice(event.price, event.currency)
        }}</span>
      </div>
    </div>
  </NuxtLink>
</template>
