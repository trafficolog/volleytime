<script setup lang="ts">
import { formatDay, type ManagerOverview } from '@volley-time/shared'
import { computed } from 'vue'

import { overviewCashChart } from '~/utils/desktop-dashboard'

/** Касса за 4 недели (W-02, 21.2.18): заголовок и столбцы строятся по `net` ряда. */
const props = defineProps<{ cash: ManagerOverview['cashWeekly']; tz: string }>()

const chart = computed(() => overviewCashChart(props.cash))
</script>

<template>
  <section class="vt-card vt-desktop-dashboard__cash" aria-labelledby="desktop-cash-weeks-title">
    <div class="vt-desktop-dashboard__section-heading">
      <h2 id="desktop-cash-weeks-title">Касса за 4 недели</h2>
      <p class="vt-desktop-dashboard__cash-headline vt-mono">{{ chart.headline }}</p>
    </div>

    <ol class="vt-desktop-dashboard__weeks">
      <li
        v-for="bar in chart.bars"
        :key="bar.from"
        class="vt-desktop-dashboard__week"
        :class="{ 'is-current': bar.current }"
      >
        <span class="vt-desktop-dashboard__week-track">
          <span
            class="vt-desktop-dashboard__week-bar"
            aria-hidden="true"
            :style="{ height: `${bar.heightPercent}%` }"
          />
        </span>
        <span class="vt-desktop-dashboard__week-day vt-mono">{{ formatDay(bar.from, tz) }}</span>
        <span class="vt-desktop-dashboard__week-value vt-mono">{{ bar.value }}</span>
      </li>
    </ol>
  </section>
</template>
