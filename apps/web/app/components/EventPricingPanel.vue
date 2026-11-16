<script setup lang="ts">
import type { EventPriceForecast, PricingFinancials } from '@volley-time/shared'

import { formatMoneyRu } from '~/utils/labels'

const props = defineProps<{
  /** Поля события: режим, сумма, момент фиксации и прогноз (21.5.10, 21.5.9). */
  event: {
    priceMode: string
    targetAmount: number | null
    pricingSettledAt: string | Date | null
    priceForecast: EventPriceForecast
  }
  financials: PricingFinancials | null
  currency: string
  tz: string
  canSettle: boolean
  pending: boolean
  /** Кабинет (20.5.6): прогноз за место и число мест берутся из GET …/price, а не из этого вида. */
  hidePerSeat?: boolean
}>()
defineEmits<{ settle: [] }>()
const amounts = computed(() =>
  props.financials?.currency === props.currency ? props.financials : null,
)
const settledTime = computed(() =>
  props.event.pricingSettledAt
    ? new Intl.DateTimeFormat('ru-RU', {
        timeZone: props.tz,
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
      }).format(new Date(props.event.pricingSettledAt))
    : null,
)
</script>

<template>
  <section
    v-if="event.priceMode === 'split'"
    class="vt-card space-y-3 p-4"
    aria-label="Распределение общей суммы"
    :aria-busy="pending"
  >
    <h2 class="text-base font-bold">
      {{ event.pricingSettledAt ? 'Зафиксировано после закрытия записи' : 'Делим общую сумму' }}
    </h2>
    <dl class="grid gap-3 sm:grid-cols-2 text-sm">
      <div>
        <dt class="text-vt-mute-2">Общая сумма</dt>
        <dd class="font-semibold tabular-nums">
          {{ formatMoneyRu(event.targetAmount ?? 0, currency) }}
        </dd>
      </div>
      <template v-if="!hidePerSeat">
        <div>
          <dt class="text-vt-mute-2">
            {{
              event.priceForecast.basis === 'capacity'
                ? 'Мест для прогноза'
                : 'Участников распределения'
            }}
          </dt>
          <dd class="font-semibold tabular-nums">{{ event.priceForecast.participantCount }}</dd>
        </div>
        <div class="sm:col-span-2">
          <dt class="text-vt-mute-2">
            {{ event.pricingSettledAt ? 'Сумма за место' : 'Прогноз за место' }}
          </dt>
          <dd class="font-semibold tabular-nums">
            <template v-if="!event.pricingSettledAt">≈ </template>
            {{ formatMoneyRu(event.priceForecast.minAmount, currency)
            }}<template v-if="event.priceForecast.maxAmount !== event.priceForecast.minAmount">
              – {{ formatMoneyRu(event.priceForecast.maxAmount, currency) }}</template
            >
          </dd>
        </div>
      </template>
      <div v-if="settledTime" class="sm:col-span-2">
        <dt class="text-vt-mute-2">Время распределения</dt>
        <dd>
          <time :datetime="String(event.pricingSettledAt)">{{ settledTime }}</time>
        </dd>
      </div>
    </dl>
    <p class="text-sm text-vt-mute-2">
      {{
        event.pricingSettledAt
          ? 'Доли зафиксированы. Отмена записи не пересчитывает суммы остальных участников.'
          : 'Точная сумма определится после ручного закрытия записи. Абонементы недоступны; лист ожидания не участвует в распределении.'
      }}
    </p>
    <p class="text-sm text-vt-mute-2">Из-за округления доли могут отличаться на одну копейку.</p>
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
      v-if="!event.pricingSettledAt"
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
