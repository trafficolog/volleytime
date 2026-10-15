<script setup lang="ts">
import { formatDay, formatTime } from '@volley-time/shared'

import type { EventListItem } from '~/components/EventCard.vue'
import { eventPricingLabel } from '~/utils/event-pricing-label'
import type { sessionsTile } from '~/utils/player-home'
import { eventStateOf, meterTintOnDark, seatsOf } from '~/utils/status-model'

/** Бенто главной игрока v3 (20.4.4, M-03): hero ближайшей игры + плитки абонемента и записей. */
const props = defineProps<{
  base: string
  tz: string
  hero: EventListItem
  /** `null` — плитки нет (абонементы выключены и остатка нет). */
  sessions: ReturnType<typeof sessionsTile>
  bookingsCount: string
}>()

const state = computed(() => eventStateOf(props.hero))
const seats = computed(() =>
  seatsOf({ taken: props.hero.taken, capacity: props.hero.capacity }, state.value),
)
const pricing = computed(() =>
  props.hero.pricing ? eventPricingLabel(props.hero.pricing, props.hero.currency) : null,
)
const place = computed(() => props.hero.venue?.name ?? props.hero.locationText)
</script>

<template>
  <div class="grid grid-cols-[1.3fr_1fr] grid-rows-2 gap-3">
    <NuxtLink
      :to="`${base}/events/${hero.id}`"
      class="vt-card vt-card--hero row-span-2 flex min-h-48 min-w-0 flex-col p-[18px]"
    >
      <div class="flex items-center justify-between gap-1.5">
        <span class="vt-cap min-w-0 !text-[var(--vt-on-hero-2)]">{{
          formatDay(hero.startsAt, tz)
        }}</span>
        <span class="flex shrink-0 items-center gap-1">
          <VtMyChip :booking="hero.myBooking" on-dark />
          <VtIcon name="chevron-r" :size="16" :stroke-width="2.2" aria-hidden="true" />
        </span>
      </div>
      <div class="vt-mono mt-3 text-[52px] font-bold leading-[0.9]">
        {{ formatTime(hero.startsAt, tz) }}
      </div>
      <div class="mt-2 break-words text-sm font-semibold">{{ hero.title }}</div>
      <div v-if="pricing" class="mt-2 text-xs text-[var(--vt-on-hero-2)]">{{ pricing.text }}</div>
      <p
        v-if="hero.pricing?.mode === 'split' && hero.pricing.basis !== 'settled' && pricing"
        class="mt-1 text-[11px] text-[var(--vt-on-hero-3)]"
      >
        {{ pricing.description }}
      </p>
      <div v-if="place" class="mt-1 break-words text-xs text-[var(--vt-on-hero-3)]">
        {{ place }}
      </div>
      <div class="mt-auto pt-4">
        <div
          role="meter"
          :aria-valuenow="seats.taken"
          aria-valuemin="0"
          :aria-valuemax="seats.capacity"
          :aria-label="`Занято ${seats.taken} из ${seats.capacity}`"
          class="h-1.5 overflow-hidden rounded-full bg-[var(--vt-on-hero-line)]"
        >
          <i
            class="block h-full rounded-full"
            :style="{
              width: `${seats.pct}%`,
              background: seats.dim ? 'var(--vt-on-hero-3)' : meterTintOnDark(seats.pct),
            }"
          />
        </div>
        <div class="mt-2 flex items-baseline justify-between gap-2 text-xs">
          <span class="text-[var(--vt-on-hero-2)]">{{ state?.label ?? 'занято' }}</span>
          <span class="vt-mono text-[15px] font-bold">{{ seats.text }}</span>
        </div>
      </div>
    </NuxtLink>

    <NuxtLink
      v-if="sessions"
      :to="`${base}/subscriptions`"
      class="vt-card vt-card--warm flex min-w-0 flex-col justify-between p-4"
    >
      <span class="flex items-center justify-between">
        <VtIcon name="ticket" :size="18" class="text-vt-orange-ink" aria-hidden="true" />
        <VtIcon
          name="chevron-r"
          :size="16"
          :stroke-width="2.2"
          class="text-vt-orange-ink"
          aria-hidden="true"
        />
      </span>
      <span v-if="sessions.kind === 'balance'">
        <span class="flex items-baseline gap-1.5">
          <span class="vt-mono text-[34px] font-bold leading-none">{{ sessions.left }}</span>
          <span class="text-sm text-vt-ink-3">из {{ sessions.total }}</span>
        </span>
        <span class="mt-1 block text-xs text-vt-ink-3">сессий осталось</span>
      </span>
      <span v-else>
        <span class="block text-base font-bold leading-tight">Нет абонемента</span>
        <span class="mt-1 block text-xs text-vt-ink-3">Посмотреть тарифы</span>
      </span>
    </NuxtLink>

    <NuxtLink
      :to="`${base}/bookings`"
      class="vt-card flex min-w-0 flex-col justify-between p-4"
      :class="sessions ? '' : 'row-span-2'"
    >
      <span class="flex items-center justify-between">
        <VtIcon name="calendar" :size="18" class="text-vt-ink-3" aria-hidden="true" />
        <VtIcon
          name="chevron-r"
          :size="16"
          :stroke-width="2.2"
          class="text-vt-mute-2"
          aria-hidden="true"
        />
      </span>
      <span>
        <span class="vt-mono block text-[34px] font-bold leading-none">{{ bookingsCount }}</span>
        <span class="mt-1 block text-xs text-vt-ink-3">мои записи</span>
      </span>
    </NuxtLink>
  </div>
</template>
