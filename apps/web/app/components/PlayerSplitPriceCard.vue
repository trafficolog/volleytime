<script setup lang="ts">
import { seatsLabel } from '~/utils/booking-seats'
import type { PlayerSplitView } from '~/utils/player-price-view'

/**
 * Блок цены события со сбором суммой (M-07, 20.4.6): прогноз «≈ … за место» с диапазоном до закрытия,
 * итоговая доля и «с вас» после, состояние «Оплачено». Только вёрстка: все суммы уже посчитаны в
 * `playerSplitViewOf` из ответа `GET …/events/{id}/price`.
 */
defineProps<{ view: PlayerSplitView }>()
</script>

<template>
  <section
    class="vt-card p-4"
    :class="view.stage === 'open' ? '' : 'player-split--closed'"
    aria-labelledby="player-split-title"
    data-player-split
    :data-stage="view.stage"
  >
    <div class="flex items-baseline justify-between gap-2">
      <h2 id="player-split-title" class="vt-cap text-vt-mute-2">{{ view.eyebrow }}</h2>
      <div class="flex shrink-0 flex-wrap items-center justify-end gap-1">
        <VtChip v-if="view.full" tone="default">мест нет</VtChip>
        <VtChip :tone="view.chip.tone" :dot="view.stage !== 'open'">{{ view.chip.text }}</VtChip>
      </div>
    </div>

    <p class="mt-2.5 flex items-baseline gap-2">
      <span class="player-split__value vt-mono" data-price-headline>{{ view.headline }}</span>
      <span class="text-sm text-vt-mute-2">за место</span>
    </p>
    <p v-if="view.rangeText" class="vt-mono text-xs text-vt-mute-2 mt-2" data-price-range>
      {{ view.rangeText }}
    </p>
    <p v-if="view.divider" class="vt-mono text-xs text-vt-mute-2 mt-2" data-price-divider>
      {{ view.divider }}
    </p>

    <template v-if="view.scenarios.length">
      <div class="vt-divider my-3.5" />
      <h3 class="vt-cap text-vt-mute-2 mb-2">Как меняется цена</h3>
      <ul class="flex flex-col gap-1.5" aria-label="Доли сбора">
        <li
          v-for="s in view.scenarios"
          :key="s.seats"
          class="flex items-center gap-2.5"
          :class="{ 'is-current': s.current }"
          data-price-scenario
        >
          <span class="vt-mono player-split__seats text-xs text-vt-mute-2">{{ s.seats }} мест</span>
          <div class="vt-meter flex-1" aria-hidden="true">
            <i
              :style="{
                width: `${s.meterPct}%`,
                background: s.current ? 'var(--vt-flame)' : 'var(--vt-stroke-2)',
              }"
            />
          </div>
          <span
            class="vt-mono player-split__amount text-right text-xs"
            :class="s.current ? 'font-bold text-vt-ink' : 'text-vt-mute-2'"
            >{{ s.amount }}</span
          >
        </li>
      </ul>
      <p class="text-xs text-vt-mute-2 mt-3 leading-snug">
        Чем больше мест займут, тем дешевле каждое. Точная сумма зафиксируется при закрытии записи.
      </p>
    </template>

    <div
      v-if="view.myTotal && view.stage === 'settled'"
      class="player-split__due mt-3.5 flex items-start gap-2.5 p-3"
      role="status"
    >
      <VtIcon name="check" :size="14" class="shrink-0 mt-0.5" />
      <p class="text-xs text-vt-ink-3 leading-snug">
        Запись закрыта, состав больше не меняется — с вас
        <b class="text-vt-ink" data-price-due>{{ view.myTotal.text }}</b
        ><template v-if="view.myTotal.seats > 1"> за {{ seatsLabel(view.myTotal.seats) }}</template
        >. Организатор подтвердит оплату после получения.
      </p>
    </div>

    <p class="text-xs text-vt-mute-2 mt-3" data-price-subscription>{{ view.subscriptionNote }}</p>
  </section>
</template>

<style scoped>
/* карточки v3 без рамки: зелёный контур «зафиксировано» рисуется вдавленной тенью */
.player-split--closed {
  box-shadow: inset 0 0 0 1px var(--vt-grass);
}

.player-split__value {
  font-family: var(--f-display);
  font-size: var(--fs-3xl);
  font-weight: 700;
  line-height: 1;
}

.player-split__seats {
  width: 56px;
}

.player-split__amount {
  width: 88px;
}

.player-split__due {
  background: var(--vt-grass-soft);
  border-radius: var(--r-chip);
}

.player-split__due :deep(svg) {
  color: var(--vt-grass-ink);
}
</style>
