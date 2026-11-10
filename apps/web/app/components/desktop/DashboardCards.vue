<script setup lang="ts">
import { computed } from 'vue'

import type { DesktopDashboardView } from '~/utils/desktop-dashboard'
import { formatOccupancy, overviewDeltaLabels } from '~/utils/desktop-dashboard'
import { formatMoneyRu } from '~/utils/labels'

/** `showSubscriptions` — настройка группы «абонементы включены» из макета layout; без неё плитка скрыта. */
const props = defineProps<{ view: DesktopDashboardView; showSubscriptions: boolean }>()

const deltas = computed(() => overviewDeltaLabels(props.view.overview))
</script>

<template>
  <div class="vt-desktop-dashboard__stats">
    <section class="vt-card vt-desktop-dashboard__balance" aria-labelledby="desktop-balance-title">
      <h2 id="desktop-balance-title" class="vt-cap">Касса группы</h2>
      <p class="vt-desktop-dashboard__balance-value vt-mono">
        {{ formatMoneyRu(view.balance.balance, view.balance.currency) }}
      </p>
      <p>Текущий баланс по подтверждённым операциям</p>
      <p class="vt-desktop-dashboard__delta" data-delta="cash">{{ deltas.cash }}</p>
    </section>

    <div class="vt-desktop-dashboard__tiles">
      <section class="vt-card vt-desktop-dashboard__tile" aria-labelledby="desktop-events-title">
        <h2 id="desktop-events-title" class="vt-cap">События за месяц</h2>
        <p class="vt-desktop-dashboard__tile-value vt-mono">
          {{ view.overview.events.thisMonth }}
        </p>
        <p v-if="deltas.events" class="vt-desktop-dashboard__delta" data-delta="events">
          {{ deltas.events }}
        </p>
      </section>

      <section class="vt-card vt-desktop-dashboard__tile" aria-labelledby="desktop-bookings-title">
        <h2 id="desktop-bookings-title" class="vt-cap">Бронирований</h2>
        <p class="vt-desktop-dashboard__tile-value vt-mono">{{ view.overview.bookings.count }}</p>
        <p>
          Заполненность
          {{ formatOccupancy(view.overview.bookings.occupancyPercent) }}
        </p>
      </section>

      <section
        v-if="showSubscriptions"
        class="vt-card vt-desktop-dashboard__tile vt-desktop-dashboard__tile--wide"
        aria-labelledby="desktop-subs-title"
      >
        <h2 id="desktop-subs-title" class="vt-cap">Активные абонементы</h2>
        <p class="vt-desktop-dashboard__tile-value vt-mono">
          {{ view.overview.subscriptions.active }}
        </p>
        <p
          v-if="deltas.subscriptions"
          class="vt-desktop-dashboard__delta"
          data-delta="subscriptions"
        >
          {{ deltas.subscriptions }}
        </p>
      </section>
    </div>
  </div>
</template>
