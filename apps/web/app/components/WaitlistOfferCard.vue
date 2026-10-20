<script setup lang="ts">
import { computed } from 'vue'

import { offerCountdown, offerDeadlineLabel, offerTitle } from '~/utils/booking-seats'

/**
 * Предложение места из листа ожидания (D-03, 20.3.1): 30 минут на подтверждение. После истечения
 * игрок покидает очередь (решение владельца 2026-10-16) — карточка говорит об этом прямо.
 * Часы `now` приходят от страницы: один таймер на экран, здесь только вид.
 */
const props = withDefaults(
  defineProps<{
    offer: { id: number; seats: number; expiresAt: string | Date }
    now: Date
    submitting?: boolean
    /** В Telegram действие живёт на MainButton — собственную кнопку не рисуем. */
    showAction?: boolean
    /** Часовой пояс группы: с ним действие называет срок — «Подтвердить до 13:29» (20.4.11). */
    tz?: string
  }>(),
  { submitting: false, showAction: true, tz: undefined },
)
const emit = defineEmits<{ accept: [] }>()
const left = computed(() => offerCountdown(props.offer.expiresAt, props.now))
</script>

<template>
  <section
    class="vt-card vt-card--warm p-4"
    :aria-label="left.expired ? 'Предложение места истекло' : 'Предложение места'"
  >
    <div class="flex items-start justify-between gap-3">
      <div class="min-w-0">
        <p class="vt-cap text-vt-mute-2">Лист ожидания</p>
        <p class="text-[15px] font-semibold mt-1">{{ offerTitle(offer.seats) }}</p>
      </div>
      <span
        v-if="!left.expired"
        class="vt-mono text-lg font-bold shrink-0"
        role="timer"
        :aria-label="left.text"
        >{{ left.clock }}</span
      >
    </div>
    <p v-if="!left.expired" class="text-sm text-vt-mute-2 mt-2">
      {{ left.text }} — подтвердите место, иначе оно уйдёт следующему, а вы покинете очередь.
    </p>
    <p v-else class="text-sm text-vt-rose-ink mt-2" role="status">{{ left.text }}</p>
    <button
      v-if="showAction && !left.expired"
      type="button"
      class="vt-btn vt-btn--primary vt-btn--lg vt-btn--full mt-3"
      :disabled="submitting"
      @click="emit('accept')"
    >
      {{ tz ? offerDeadlineLabel(offer.expiresAt, tz) : 'Принять место' }}
    </button>
  </section>
</template>
