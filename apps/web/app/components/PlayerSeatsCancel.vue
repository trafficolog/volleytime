<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import { seatsLabel } from '~/utils/booking-seats'

/**
 * Частичная отмена мест своей записи (20.4.8, M-09): игрок снимает от 1 до `total - 1` мест,
 * остальные остаются. Правила (срок, политика, очередь, оплата) проверяет сервер; здесь только выбор числа.
 * Событие → `reduce(kept)` — сколько мест оставить.
 */
const props = defineProps<{ total: number; disabled?: boolean }>()
const emit = defineEmits<{ reduce: [kept: number] }>()

const removed = ref(1)
watch(
  () => props.total,
  () => {
    removed.value = 1
  },
)
const canDec = computed(() => !props.disabled && removed.value > 1)
const canInc = computed(() => !props.disabled && removed.value < props.total - 1)
const step = (delta: number) => {
  const next = removed.value + delta
  if (next >= 1 && next <= props.total - 1) removed.value = next
}
</script>

<template>
  <div v-if="total > 1" class="mt-3 space-y-2" role="group" aria-label="Отменить часть мест">
    <div class="flex items-center gap-3">
      <span class="flex-1 text-sm font-semibold">Отменить часть мест</span>
      <button
        type="button"
        class="vt-btn vt-btn--ghost vt-seats-step"
        aria-label="Снять меньше мест"
        :disabled="!canDec"
        @click="step(-1)"
      >
        −
      </button>
      <span class="vt-mono vt-seats-count" aria-hidden="true">{{ removed }}</span>
      <span class="sr-only" aria-live="polite">{{ seatsLabel(removed) }}</span>
      <button
        type="button"
        class="vt-btn vt-btn--ghost vt-seats-step"
        aria-label="Снять больше мест"
        :disabled="!canInc"
        @click="step(1)"
      >
        +
      </button>
    </div>
    <button
      type="button"
      class="vt-btn vt-btn--ghost vt-btn--sm vt-btn--full"
      :disabled="disabled"
      @click="emit('reduce', total - removed)"
    >
      Снять {{ seatsLabel(removed) }}
    </button>
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
