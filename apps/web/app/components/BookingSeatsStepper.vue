<script setup lang="ts">
import { computed, useId } from 'vue'

import { seatsHeadline, seatsLabel, seatsUpTo } from '~/utils/booking-seats'

/**
 * Степпер числа мест записи 1…max (M-06, 20.4.5). Граница max — лимит группы и вместимость
 * события (`maxSeatsFor`); сервер проверяет её повторно. Кнопки 44×44, число озвучивается.
 */
const seats = defineModel<number>({ required: true })
const props = withDefaults(
  defineProps<{
    max: number
    min?: number
    disabled?: boolean
  }>(),
  { min: 1, disabled: false },
)
const labelId = useId()
const canDec = computed(() => !props.disabled && seats.value > props.min)
const canInc = computed(() => !props.disabled && seats.value < props.max)
const step = (delta: number) => {
  const next = seats.value + delta
  if (next >= props.min && next <= props.max) seats.value = next
}
</script>

<template>
  <div class="flex items-center gap-3.5" role="group" :aria-labelledby="labelId">
    <div class="flex-1 min-w-0">
      <div :id="labelId" class="text-[15px] font-semibold">{{ seatsHeadline(seats) }}</div>
      <div class="text-xs text-vt-mute-2 mt-0.5">Можно занять до {{ seatsUpTo(max) }}</div>
    </div>
    <div class="flex items-center gap-2.5">
      <button
        type="button"
        class="vt-btn vt-btn--ghost vt-seats-step"
        aria-label="Меньше мест"
        :disabled="!canDec"
        @click="step(-1)"
      >
        −
      </button>
      <output class="vt-mono vt-seats-count" aria-live="polite" :aria-label="seatsLabel(seats)">{{
        seats
      }}</output>
      <button
        type="button"
        class="vt-btn vt-btn--ghost vt-seats-step"
        aria-label="Больше мест"
        :disabled="!canInc"
        @click="step(1)"
      >
        +
      </button>
    </div>
  </div>
</template>

<style scoped>
.vt-seats-step {
  min-width: 44px;
  min-height: 44px;
  padding: 0;
  justify-content: center;
  font-size: 18px;
  line-height: 1;
}
.vt-seats-count {
  min-width: 24px;
  text-align: center;
  font-size: 18px;
  font-weight: 700;
}
</style>
