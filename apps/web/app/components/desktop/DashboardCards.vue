<script setup lang="ts">
import type { DesktopDashboardView } from '~/utils/desktop-dashboard'
import { formatMoneyRu } from '~/utils/labels'

defineProps<{ view: DesktopDashboardView }>()
</script>

<template>
  <div class="vt-desktop-dashboard__stats">
    <section class="vt-card vt-desktop-dashboard__balance" aria-labelledby="desktop-balance-title">
      <h2 id="desktop-balance-title" class="vt-cap">Касса группы</h2>
      <p class="vt-desktop-dashboard__balance-value vt-mono">
        {{ formatMoneyRu(view.balance.balance, view.balance.currency) }}
      </p>
      <p>Текущий баланс по подтверждённым операциям</p>
    </section>

    <section class="vt-card vt-desktop-dashboard__pending" aria-labelledby="desktop-pending-title">
      <h2 id="desktop-pending-title" class="vt-cap">Ждут подтверждения</h2>
      <p class="vt-desktop-dashboard__pending-count vt-mono">{{ view.pendingCount }}</p>
      <p>{{ formatMoneyRu(view.pendingAmount, view.balance.currency) }} в валюте группы</p>
    </section>
  </div>
</template>
