<script setup lang="ts">
import type { EventPricingView, PricingFinancials } from '@volley-time/shared'

import { formatMoneyRu } from '~/utils/labels'

const props = defineProps<{
  pricing: EventPricingView
  financials: PricingFinancials | null
  currency: string
  canSettle: boolean
  pending: boolean
}>()
defineEmits<{ settle: [] }>()
const amounts = computed(() =>
  props.financials?.currency === props.currency ? props.financials : null,
)
</script>

<template>
  <section
    v-if="pricing.mode === 'split'"
    class="vt-card space-y-3 p-4"
    aria-label="Распределение общей суммы"
    :aria-busy="pending"
  >
    <h2 class="text-base font-bold">
      {{ pricing.settledAt ? 'Зафиксировано после закрытия записи' : 'Делим общую сумму' }}
    </h2>
    <dl class="grid gap-3 sm:grid-cols-2 text-sm">
      <div>
        <dt class="text-vt-mute-2">Общая сумма</dt>
        <dd class="font-semibold tabular-nums">
          {{ formatMoneyRu(pricing.targetAmount ?? 0, currency) }}
        </dd>
      </div>
      <div>
        <dt class="text-vt-mute-2">
          {{ pricing.basis === 'capacity' ? 'Мест для прогноза' : 'Участников распределения' }}
        </dt>
        <dd class="font-semibold tabular-nums">{{ pricing.participantCount }}</dd>
      </div>
      <div class="sm:col-span-2">
        <dt class="text-vt-mute-2">
          {{ pricing.settledAt ? 'Сумма за место' : 'Прогноз за место' }}
        </dt>
        <dd class="font-semibold tabular-nums">
          {{ formatMoneyRu(pricing.minAmount, currency)
          }}<template v-if="pricing.maxAmount !== pricing.minAmount">
            – {{ formatMoneyRu(pricing.maxAmount, currency) }}</template
          >
        </dd>
      </div>
    </dl>
    <p class="text-sm text-vt-mute-2">
      {{
        pricing.settledAt
          ? 'Доли зафиксированы. Отмена записи не пересчитывает суммы остальных участников.'
          : 'Точная сумма определится после ручного закрытия записи. Абонементы недоступны; лист ожидания не участвует в распределении.'
      }}
    </p>
    <dl v-if="amounts" class="grid gap-3 text-sm sm:grid-cols-2">
      <div>
        <dt class="text-vt-mute-2">Получено</dt>
        <dd class="font-semibold tabular-nums">{{ formatMoneyRu(amounts.collected, currency) }}</dd>
      </div>
      <div>
        <dt class="text-vt-mute-2">Ожидает оплаты</dt>
        <dd class="font-semibold tabular-nums">{{ formatMoneyRu(amounts.pending, currency) }}</dd>
      </div>
      <div v-if="amounts.cancelled">
        <dt class="text-vt-mute-2">Отменённые оплаты</dt>
        <dd class="tabular-nums">{{ formatMoneyRu(amounts.cancelled, currency) }}</dd>
      </div>
      <div v-if="amounts.refunded">
        <dt class="text-vt-mute-2">Возвращено</dt>
        <dd class="tabular-nums">{{ formatMoneyRu(amounts.refunded, currency) }}</dd>
      </div>
    </dl>
    <button
      v-if="!pricing.settledAt"
      type="button"
      class="vt-btn vt-btn--primary min-h-11 w-full whitespace-normal sm:w-auto"
      :disabled="!canSettle || pending"
      @click="$emit('settle')"
    >
      Закрыть запись и распределить
    </button>
    <p v-if="pending" role="status" class="text-sm text-vt-mute-2">Подтверждаем распределение…</p>
  </section>
</template>
