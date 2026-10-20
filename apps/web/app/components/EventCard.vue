<script setup lang="ts">
import {
  formatDay,
  formatTime,
  type EventPriceQuote,
  type EventPricingView,
} from '@volley-time/shared'

import { eventPricingLabel, splitBookingPaymentLabel } from '~/utils/event-pricing-label'
import { formatPrice } from '~/utils/labels'
import { bookingPaymentChip } from '~/utils/player-event'
import { quotePriceLabel } from '~/utils/player-price-view'
import { waitlistPeopleLabel } from '~/utils/status-model'

export interface EventListItem {
  id: number
  title: string
  status: string
  startsAt: string
  endsAt: string
  capacity: number
  price: number
  pricing?: EventPricingView
  /**
   * Цена split из `quoteEventPrice` (то же, что `GET …/events/{id}/price`, 20.4.6): Главная игрока.
   * `null` — расчёта нет (fixed, управляющий или цена недоступна); `undefined` — источник не передан
   * (список событий, «Мои записи»): остаётся проекция `pricing`.
   */
  priceQuote?: (EventPriceQuote & { currency?: string }) | null
  currency: string
  taken: number
  waitlist: number
  myBooking: {
    id: number
    status: string
    waitPos?: number | null
    waitlistSeats?: number | null
  } | null
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
const quoteMode = computed(
  () => props.event.pricing?.mode === 'split' && props.event.priceQuote !== undefined,
)
const hasActiveBooking = computed(() =>
  ['confirmed', 'pending_payment', 'attended', 'no_show'].includes(
    props.event.myBooking?.status ?? '',
  ),
)
const priceLabel = computed(() => {
  if (quoteMode.value) {
    // цена из ответа цены; отменённое событие цены не показывает, недоступный расчёт — без числа
    const label =
      props.event.status === 'cancelled'
        ? null
        : quotePriceLabel(props.event.priceQuote, props.event.currency, {
            hasBooking: hasActiveBooking.value,
            waitlisted: props.event.myBooking?.status === 'waitlisted',
          })
    return { text: label?.text ?? '', description: label?.description ?? '', payable: false }
  }
  return props.event.pricing
    ? eventPricingLabel(props.event.pricing, props.event.currency)
    : {
        text: formatPrice(props.event.price, props.event.currency),
        description: '',
        payable: props.event.price > 0,
      }
})
const forecastNote = computed(
  () =>
    props.event.pricing?.mode === 'split' &&
    (quoteMode.value
      ? props.event.priceQuote?.basis === 'forecast'
      : props.event.pricing.basis !== 'settled') &&
    !!priceLabel.value.description,
)
const paymentLabel = computed(() =>
  props.event.myBooking
    ? bookingPaymentChip(props.event.myBooking.status, props.event.pricing)
    : null,
)
const splitWaitlistNote = computed(() =>
  props.event.pricing && props.event.myBooking?.status === 'waitlisted'
    ? splitBookingPaymentLabel(props.event.pricing, 'waitlisted')
    : null,
)
</script>

<template>
  <NuxtLink v-if="presentation === 'schedule'" :to="to" class="player-schedule-row">
    <div class="w-11 shrink-0 text-center">
      <div class="vt-mono text-[28px] leading-none">{{ calendarDay }}</div>
      <div class="text-[11px] text-vt-mute-2 mt-1">{{ weekday }}</div>
    </div>
    <div class="flex-1 min-w-0">
      <div class="font-semibold text-[15px] truncate">{{ event.title }}</div>
      <div class="text-[12.5px] text-vt-mute-2 mt-0.5 flex items-center gap-1.5">
        <span class="truncate min-w-0">{{
          `${formatTime(event.startsAt, tz)}${event.venue || event.locationText ? ` · ${event.venue?.name ?? event.locationText}` : ''}`
        }}</span>
        <VtStateChip :event="event" />
      </div>
      <div
        v-if="(event.price > 0 || event.pricing?.mode === 'split') && priceLabel.text"
        class="text-[11px] text-vt-mute-2 mt-1"
      >
        {{ priceLabel.text }}
      </div>
      <p v-if="forecastNote" class="text-[11px] text-vt-mute-2 mt-1">
        {{ priceLabel.description }}
      </p>
      <p v-if="splitWaitlistNote" class="text-[11px] text-vt-mute-2 mt-1">
        {{ splitWaitlistNote.description }}
      </p>
    </div>
    <div class="flex shrink-0 flex-col items-end gap-1">
      <VtMyChip :booking="event.myBooking" />
      <VtSeatsMini :taken="event.taken" :capacity="event.capacity" :event="event" />
      <VtChip v-if="paymentLabel" :tone="paymentLabel.tone">{{ paymentLabel.text }}</VtChip>
    </div>
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
        <VtStateChip :event="event" />
      </div>
      <div class="text-[12px] text-vt-mute-2 truncate">
        {{ formatDay(event.startsAt, tz) }}
        <template v-if="event.venue || event.locationText">
          · {{ event.venue?.name ?? event.locationText }}</template
        >
      </div>
      <div class="mt-2 flex items-center gap-2">
        <VtSeatsMini :taken="event.taken" :capacity="event.capacity" :event="event" :width="96" />
        <span v-if="event.waitlist" class="text-[11.5px] text-vt-mute-2">{{
          waitlistPeopleLabel(event.waitlist)
        }}</span>
      </div>
      <div class="mt-2 flex flex-wrap items-center gap-1.5">
        <VtMyChip :booking="event.myBooking" />
        <VtChip v-if="paymentLabel" :tone="paymentLabel.tone">{{ paymentLabel.text }}</VtChip>
        <span class="ml-auto text-[12px] font-semibold">{{ priceLabel.text }}</span>
      </div>
      <p v-if="forecastNote" class="text-[11px] text-vt-mute-2 mt-1">
        {{ priceLabel.description }}
      </p>
      <p v-if="splitWaitlistNote" class="text-[11px] text-vt-mute-2 mt-1">
        {{ splitWaitlistNote.description }}
      </p>
    </div>
  </NuxtLink>
</template>
