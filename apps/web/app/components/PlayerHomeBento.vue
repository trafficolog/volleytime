<script setup lang="ts">
import { formatDay, formatTime } from '@volley-time/shared'

import type { EventListItem } from '~/components/EventCard.vue'
import PlayerHomeTiles from '~/components/PlayerHomeTiles.vue'
import { eventPricingLabel } from '~/utils/event-pricing-label'
import type { sessionsTile } from '~/utils/player-home'
import { quotePriceLabel } from '~/utils/player-price-view'
import { eventStateOf, meterTintOnDark, seatsOf } from '~/utils/status-model'

/** Бенто главной игрока v3 (20.4.4, M-03): hero ближайшей игры + плитки абонемента и записей. */
const props = defineProps<{
  base: string
  tz: string
  hero: EventListItem
  /** `null` — плитки нет (абонементы выключены и остатка нет). */
  sessions: ReturnType<typeof sessionsTile>
  bookingsCount: number
  /** Сколько моих записей ждут оплаты (точный счётчик дашборда). */
  awaitingPayment: number
}>()

const state = computed(() => eventStateOf(props.hero))
const seats = computed(() =>
  seatsOf({ taken: props.hero.taken, capacity: props.hero.capacity }, state.value),
)
// split: цена из `quoteEventPrice` (то же, что GET …/price, 20.4.6); `null` — без числа, а не
// подстановка из `readEventPricing`. Без поля `priceQuote` остаётся проекция `pricing`.
const quoteMode = computed(
  () => props.hero.pricing?.mode === 'split' && props.hero.priceQuote !== undefined,
)
const pricing = computed(() => {
  if (quoteMode.value) {
    const label =
      props.hero.status === 'cancelled'
        ? null
        : quotePriceLabel(props.hero.priceQuote, props.hero.currency, {
            hasBooking: ['confirmed', 'pending_payment', 'attended', 'no_show'].includes(
              props.hero.myBooking?.status ?? '',
            ),
          })
    return label
  }
  return props.hero.pricing ? eventPricingLabel(props.hero.pricing, props.hero.currency) : null
})
const forecastNote = computed(
  () =>
    props.hero.pricing?.mode === 'split' &&
    !!pricing.value &&
    (quoteMode.value
      ? props.hero.priceQuote?.basis === 'forecast'
      : props.hero.pricing.basis !== 'settled'),
)
const place = computed(() => props.hero.venue?.name ?? props.hero.locationText)
</script>

<template>
  <div class="grid grid-cols-[1.3fr_1fr] grid-rows-2 gap-3">
    <NuxtLink
      :to="`${base}/events/${hero.id}`"
      class="vt-card vt-card--hero row-span-2 flex min-h-48 min-w-0 flex-col p-[18px]"
    >
      <div class="flex flex-wrap items-center justify-between gap-x-1.5 gap-y-1">
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
      <p v-if="forecastNote && pricing" class="mt-1 text-[11px] text-[var(--vt-on-hero-3)]">
        {{ pricing.description }}
      </p>
      <div v-if="place" class="mt-1 break-words text-xs text-[var(--vt-on-hero-3)]">
        {{ place }}
      </div>
      <div class="mt-auto pt-4">
        <!--
          Не VtMeter: у него нет варианта для синей поверхности (светлые тона шкалы на hero,
          `meterTintOnDark`) и нет строки «подпись + цифра» под шкалой. Шкала декоративна
          (aria-hidden): занятость читается из видимой цифры «12/14» в той же ссылке.
        -->
        <div
          data-seats-meter
          aria-hidden="true"
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

    <PlayerHomeTiles
      :base="base"
      :sessions="sessions"
      :bookings-count="bookingsCount"
      :awaiting-payment="awaitingPayment"
    />
  </div>
</template>
