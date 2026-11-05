<script setup lang="ts">
import type { ManagerOverview } from '@volley-time/shared'
import { computed } from 'vue'

import { pendingPaymentMeta, pendingPaymentTitle } from '~/utils/desktop-dashboard'
import { pluralRu } from '~/utils/desktop-players'
import { formatMoneyRu } from '~/utils/labels'

/** Строк на экране, как в макете W-02; остальные — по ссылке «Все оплаты». */
const VISIBLE_ROWS = 4

/** Платежи, ждущие подтверждения (W-02, 21.2.18). «Ждут» — число строк списка. */
const props = defineProps<{ pending: ManagerOverview['pendingPayments']; orgId: number }>()

const visibleItems = computed(() => props.pending.items.slice(0, VISIBLE_ROWS))
</script>

<template>
  <section
    class="vt-card vt-desktop-dashboard__pending-list"
    aria-labelledby="desktop-pending-title"
  >
    <div class="vt-desktop-dashboard__section-heading">
      <h2 id="desktop-pending-title">
        Платежи
        <span class="vt-desktop-dashboard__pending-badge">
          {{ pending.count }} {{ pluralRu(pending.count, 'ждёт', 'ждут', 'ждут') }}
        </span>
      </h2>
      <DesktopAllPaymentsLink :org-id="orgId" />
    </div>

    <div v-if="pending.count === 0" class="vt-desktop-dashboard__empty">
      <p>Ожидающих оплат нет.</p>
    </div>
    <ul v-else class="vt-desktop-dashboard__payment-list">
      <li v-for="item in visibleItems" :key="item.id" class="vt-desktop-dashboard__payment">
        <span class="vt-desktop-dashboard__payment-text">
          <strong>{{ pendingPaymentTitle(item) }}</strong>
          <small>{{ pendingPaymentMeta(item) }}</small>
        </span>
        <span class="vt-desktop-dashboard__payment-amount vt-mono">
          {{ formatMoneyRu(item.amount, item.currency) }}
        </span>
      </li>
    </ul>
  </section>
</template>
