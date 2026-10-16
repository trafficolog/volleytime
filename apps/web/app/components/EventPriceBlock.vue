<script setup lang="ts">
import type { PriceView } from '~/utils/event-price-view'

/**
 * Прогноз цены и доли сбора (W-05, 20.5.6). Все суммы — из `priceViewOf`, то есть из ответа
 * `GET …/events/{id}/price` (`quoteEventPrice`); здесь только вёрстка.
 */
defineProps<{ view: PriceView }>()
</script>

<template>
  <section class="vt-card vt-card--cool vt-price-block" aria-labelledby="event-price-title">
    <div class="vt-price-block__head">
      <h2 id="event-price-title">
        {{ view.basis === 'settled' ? 'Доля зафиксирована' : 'Прогноз цены' }}
      </h2>
      <span v-if="view.basis === 'forecast'" class="vt-chip vt-chip--amber">уточнится</span>
      <span v-if="view.full" class="vt-chip vt-chip--state">мест нет</span>
    </div>
    <p class="vt-price-block__value">
      <span class="vt-mono" data-price-headline>{{ view.headline }}</span>
      <small>{{ view.basis === 'settled' ? 'с места' : 'с места сейчас' }}</small>
    </p>
    <p v-if="view.divider" class="vt-price-block__meta">{{ view.divider }}</p>
    <p v-if="view.rangeText" class="vt-price-block__meta" data-price-range>{{ view.rangeText }}</p>
    <ul v-if="view.scenarios.length" class="vt-price-block__scenarios" aria-label="Доли сбора">
      <li v-for="s in view.scenarios" :key="s.seats" :class="{ 'is-current': s.current }">
        <span>{{ s.seats }} мест</span>
        <strong class="vt-mono">{{ s.amount }}</strong>
      </li>
    </ul>
    <p v-if="view.basis === 'forecast'" class="vt-price-block__meta">
      Сумма распределится при закрытии записи. Лист ожидания в распределении не участвует.
    </p>
  </section>
</template>
