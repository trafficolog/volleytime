<script setup lang="ts">
import type { Booking, Event, Venue } from '@volley-time/db'
import {
  formatTime,
  type EventPriceQuote,
  type EventPricingView,
  type SeatPaymentsView,
} from '@volley-time/shared'

import { offerDeadlineLabel } from '~/utils/booking-seats'
import { eventPricingLabel, splitBookingPaymentLabel } from '~/utils/event-pricing-label'
import { releasedPaidSeatsLabel } from '~/utils/player-booking-cancel'
import { bookingPaymentChip } from '~/utils/player-event'
import { quotePriceLabel } from '~/utils/player-price-view'
import { participationOf } from '~/utils/status-model'

export type MyBooking = Booking & {
  pricing: EventPricingView
  /** Статус оплаты мест своей записи (21.1.8, D-14): счётчики без сумм. */
  seatPayments?: SeatPaymentsView
  /** Цена split из `quoteEventPrice` (как GET …/price, 20.4.6); `undefined` — источник не передан. */
  priceQuote?: (EventPriceQuote & { currency?: string }) | null
  event: Event & { venue: Venue | null }
  /** Место в очереди и действующее предложение — только свои (20.4.11, D-03). */
  waitPos?: number | null
  offer?: { id: number; seats: number; expiresAt: string } | null
}

/**
 * Карточка записи на экране «Мои записи» v3 (20.4.9, M-13): дата крупно, название, время и зал,
 * чипы участия и оплаты, кнопка отмены. Лист ожидания — та же карточка с кнопкой «Выйти».
 */
const props = defineProps<{
  booking: MyBooking
  orgId: number
  tz: string
  cancellable: boolean
  cancelling: boolean
}>()
const emit = defineEmits<{ cancel: [] }>()

const b = computed(() => props.booking)
const waitlisted = computed(() => b.value.status === 'waitlisted')
const day = computed(() =>
  new Intl.DateTimeFormat('ru-RU', { timeZone: props.tz, day: 'numeric' }).format(
    new Date(b.value.event.startsAt),
  ),
)
const weekday = computed(() =>
  new Intl.DateTimeFormat('ru-RU', { timeZone: props.tz, weekday: 'short' }).format(
    new Date(b.value.event.startsAt),
  ),
)
/** Цена карточки: split — из ответа цены (без числа, если расчёта нет), иначе прежняя проекция. */
const price = computed(() => {
  const x = b.value
  // отменённая запись показывает зафиксированную долю/возврат (факт, не прогноз) — прежняя проекция
  if (x.pricing.mode === 'split' && x.priceQuote !== undefined && x.status !== 'cancelled') {
    const label =
      x.event.status === 'cancelled'
        ? null
        : quotePriceLabel(x.priceQuote, x.event.currency, {
            hasBooking: ['confirmed', 'pending_payment', 'attended', 'no_show'].includes(x.status),
            waitlisted: x.status === 'waitlisted',
          })
    return {
      text: label?.text ?? '',
      description: label?.description ?? '',
      forecast: x.priceQuote?.basis === 'forecast' && !!label,
    }
  }
  const label = eventPricingLabel(x.pricing, x.event.currency)
  return { ...label, forecast: x.pricing.mode === 'split' && x.pricing.basis !== 'settled' }
})
const paymentChip = computed(() => bookingPaymentChip(b.value.status, b.value.pricing))
const releasedLabel = computed(() =>
  releasedPaidSeatsLabel(b.value.seatPayments?.releasedPaidSeats ?? 0),
)
</script>

<template>
  <div class="vt-card vt-card--raised p-3.5" data-booking-row>
    <NuxtLink
      :to="`/m/orgs/${orgId}/events/${b.event.id}`"
      class="vt-hit-44 flex items-start gap-3.5"
    >
      <span class="w-12 shrink-0 text-center" aria-hidden="true">
        <span class="vt-mono block text-[28px] font-bold leading-none">{{ day }}</span>
        <span class="vt-cap mt-1 block !text-[10px] text-vt-mute-2">{{ weekday }}</span>
      </span>
      <span class="min-w-0 flex-1">
        <span class="block truncate text-base font-bold">{{ b.event.title }}</span>
        <span class="mt-0.5 block truncate text-xs text-vt-mute-2"
          >{{ formatTime(b.event.startsAt, tz)
          }}<template v-if="b.event.venue"> · {{ b.event.venue.name }}</template></span
        >
        <span class="mt-1.5 block vt-mono text-xs">{{ price.text }}</span>
        <span v-if="price.forecast" class="mt-1 block text-xs text-vt-mute-2">{{
          price.description
        }}</span>
        <span
          v-if="waitlisted && b.pricing.mode === 'split'"
          class="mt-1 block text-xs text-vt-mute-2"
          >{{ splitBookingPaymentLabel(b.pricing, b.status)?.description }}</span
        >
        <span v-if="b.offer" class="mt-1 block text-xs font-semibold text-vt-amber-ink">{{
          offerDeadlineLabel(b.offer.expiresAt, tz)
        }}</span>
        <span v-else-if="waitlisted && b.waitPos !== null" class="mt-1 block text-xs text-vt-mute-2"
          >Вы в очереди · уведомим, когда освободится место</span
        >
        <span class="mt-2 flex flex-wrap gap-1.5">
          <VtMyChip v-if="participationOf(b)" :booking="b" />
          <VtChip v-else-if="b.status === 'attended'">Был</VtChip>
          <VtChip v-else-if="b.status === 'no_show'">Не пришёл</VtChip>
          <VtChip v-if="paymentChip" :tone="paymentChip.tone">{{ paymentChip.text }}</VtChip>
          <VtChip v-else-if="b.status === 'cancelled'">Запись отменена</VtChip>
          <VtChip v-if="releasedLabel" data-released-paid>{{ releasedLabel }}</VtChip>
        </span>
      </span>
    </NuxtLink>
    <button
      v-if="cancellable"
      type="button"
      class="vt-btn vt-btn--ghost vt-btn--sm vt-btn--full mt-3"
      :disabled="cancelling"
      @click="emit('cancel')"
    >
      {{ waitlisted ? 'Выйти из листа ожидания' : 'Отменить запись' }}
    </button>
  </div>
</template>
