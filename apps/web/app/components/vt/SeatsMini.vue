<script setup lang="ts">
import { computed } from 'vue'

import {
  eventStateOf,
  meterTint,
  meterTintOnDark,
  seatsOf,
  type EventState,
} from '~/utils/status-model'

/**
 * Ось «Места»: цифра + шкала, цвет живёт на шкале (19.1.2).
 * `taken` — занятые места (не игроки): многоместная запись (20.1.2) подставляет сумму мест.
 * Состояние события (`state`/`event`) гасит шкалу в нейтральный серый.
 */
const props = withDefaults(
  defineProps<{
    taken: number
    capacity: number
    state?: EventState | null
    event?: { status: string; startsAt: string | Date; endsAt?: string | Date | null }
    now?: Date
    width?: number
    onDark?: boolean
  }>(),
  { state: null, event: undefined, now: undefined, width: 56, onDark: false },
)
const seats = computed(() =>
  seatsOf(
    { taken: props.taken, capacity: props.capacity },
    props.state ?? (props.event ? eventStateOf(props.event, props.now) : null),
  ),
)
const fill = computed(() =>
  seats.value.dim
    ? 'var(--vt-stroke-2)'
    : props.onDark
      ? meterTintOnDark(seats.value.pct)
      : meterTint(seats.value.pct),
)
</script>

<template>
  <span class="vt-seats-mini" :class="{ 'vt-seats-mini--on-hero': onDark }">
    <span
      class="vt-seats-mini__track"
      role="meter"
      :aria-valuenow="seats.taken"
      aria-valuemin="0"
      :aria-valuemax="seats.capacity"
      :aria-label="`Занято ${seats.taken} из ${seats.capacity}`"
      :style="{ width: `${width}px` }"
    >
      <i :style="{ width: `${seats.pct}%`, background: fill }" />
    </span>
    <span class="vt-seats-mini__text vt-mono">{{ seats.text }}</span>
  </span>
</template>

<style scoped>
.vt-seats-mini {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}
.vt-seats-mini__track {
  display: inline-block;
  height: 5px;
  overflow: hidden;
  border-radius: 99px;
  background: var(--vt-bone-2);
}
.vt-seats-mini__track > i {
  display: block;
  height: 100%;
  border-radius: inherit;
}
.vt-seats-mini__text {
  min-width: 34px;
  text-align: right;
  font-size: var(--fs-sm, 12.5px);
  font-weight: 600;
  white-space: nowrap;
  color: var(--vt-ink-3);
}
.vt-seats-mini--on-hero .vt-seats-mini__track {
  background: var(--vt-on-hero-fill);
}
.vt-seats-mini--on-hero .vt-seats-mini__text {
  color: var(--vt-on-hero-2);
}
</style>
