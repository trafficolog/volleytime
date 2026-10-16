<script setup lang="ts">
import { BOOKING_METHOD_LABELS, displayName, formatMoneyRu } from '~/utils/labels'
import {
  rosterRowOf,
  type RosterBooking,
  type RosterPricing,
  type RosterRowView,
} from '~/utils/organizer-roster'

/**
 * Общая строка состава для организатора (20.5.6, 19.1.2): кабинет и Mini App. Статусы, «+N» и
 * словарь организатора — из `rosterRowOf`; действия строки (отметка посещения, снять, оплата)
 * приходят слотом `actions`, чтобы у каждой поверхности была своя раскладка.
 */
const props = defineProps<{
  booking: RosterBooking & {
    user: { name: string | null; telegramUsername: string | null; image: string | null }
  }
  pricing: RosterPricing
  currency: string
  /** Подпись уровня игрока (В1–В4+): только из маршрута для участников группы. */
  levelLabel?: string | null
  /** Порядковый номер в составе (кабинет). */
  index?: number
}>()

const view = computed<RosterRowView>(() => rosterRowOf(props.booking, props.pricing))
const name = computed(() => displayName(props.booking.user))
const method = computed(() => BOOKING_METHOD_LABELS[props.booking.method] ?? props.booking.method)
const sub = computed(() =>
  [
    view.value.seatsText
      ? view.value.totalAmount !== null
        ? `${view.value.seatsText} · ${formatMoneyRu(view.value.totalAmount, props.currency)}`
        : view.value.seatsText
      : null,
    method.value,
    view.value.queuedText,
  ]
    .filter(Boolean)
    .join(' · '),
)
</script>

<template>
  <div class="vt-roster-row" :data-kind="view.kind">
    <span v-if="index !== undefined" class="vt-roster-row__n vt-mono" aria-hidden="true">{{
      index
    }}</span>
    <VtAvatar size="sm" :name="name" :src="booking.user.image" />
    <div class="vt-roster-row__who">
      <div class="vt-roster-row__name">
        <strong>{{ name }}</strong>
        <VtChip
          v-if="view.extraSeats > 0"
          tone="flame"
          class="vt-roster-row__extra"
          :aria-label="`ещё ${view.extraSeats} к месту игрока`"
          >+{{ view.extraSeats }}</VtChip
        >
        <VtChip v-if="levelLabel" class="vt-roster-row__level" :title="`Уровень: ${levelLabel}`">{{
          levelLabel
        }}</VtChip>
      </div>
      <div class="vt-roster-row__sub">{{ sub }}</div>
    </div>
    <VtChip v-if="view.chip" :tone="view.chip.tone" class="vt-roster-row__status">{{
      view.chip.text
    }}</VtChip>
    <span
      v-else-if="view.paid"
      class="vt-roster-row__paid"
      role="img"
      aria-label="в составе, оплачено"
    >
      <VtIcon name="check" :size="14" :stroke-width="2.2" />
    </span>
    <slot name="actions" :view="view" />
  </div>
</template>
