<script setup lang="ts">
import { computed } from 'vue'

import { eventBalanceCard } from '~/utils/cabinet-shell'

/** Плашка «Баланс событий» в сайдбаре кабинета (20.5.3, W-01). Данные — GET /event-balance (20.2.1). */
const props = defineProps<{ orgId: number }>()

type Balance = { balance: number; lowThreshold: number; low: boolean }

const { data, error } = useFetch<{ eventBalance: Balance }>(
  () => `/api/organizations/${props.orgId}/event-balance`,
  { key: () => `cabinet-event-balance-${props.orgId}`, lazy: true, server: false },
)
const card = computed(() =>
  eventBalanceCard(error.value ? null : (data.value?.eventBalance ?? null)),
)
</script>

<template>
  <section class="vt-card vt-card--hero vt-cabinet-balance" aria-labelledby="cabinet-balance-title">
    <h2 id="cabinet-balance-title" class="vt-cabinet-balance__title">Баланс событий</h2>
    <p class="vt-cabinet-balance__figure">
      <span class="vt-mono vt-cabinet-balance__value">{{ card.value }}</span>
      <span class="vt-cabinet-balance__caption">{{ card.caption }}</span>
    </p>
    <p v-if="card.low" class="vt-cabinet-balance__low" role="status">Баланс заканчивается</p>
  </section>
</template>
