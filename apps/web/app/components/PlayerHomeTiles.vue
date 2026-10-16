<script setup lang="ts">
import { awaitingPaymentLabel, type sessionsTile } from '~/utils/player-home'

/**
 * Плитки главной игрока (20.4.4): «сессий осталось» и «мои записи». Используются и в бенто с hero,
 * и в состоянии без ближайшей игры — одинаковые шевроны и маркер `data-awaiting-payment`.
 * Корень — фрагмент: плитки становятся ячейками сетки родителя.
 */
const props = defineProps<{
  base: string
  /** `null` — плитки нет (абонементы выключены и остатка нет). */
  sessions: ReturnType<typeof sessionsTile>
  /** Точное число предстоящих активных записей (дашборд). */
  bookingsCount: number
  /** Сколько из них ждут оплаты (дашборд). */
  awaitingPayment: number
  /** `bento` — рядом с hero (две строки), `row` — отдельная строка без hero. */
  variant?: 'bento' | 'row'
}>()

const awaiting = computed(() => awaitingPaymentLabel(props.awaitingPayment))
const bookingsClass = computed(() =>
  props.sessions ? '' : props.variant === 'row' ? 'col-span-2' : 'row-span-2',
)
</script>

<template>
  <NuxtLink
    v-if="sessions"
    :to="`${base}/subscriptions`"
    class="vt-card vt-card--warm flex min-h-24 min-w-0 flex-col justify-between p-4"
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
    class="vt-card flex min-h-24 min-w-0 flex-col justify-between p-4"
    :class="bookingsClass"
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
      <VtChip v-if="awaiting" tone="amber" data-awaiting-payment class="mt-1.5">{{
        awaiting
      }}</VtChip>
    </span>
  </NuxtLink>
</template>
