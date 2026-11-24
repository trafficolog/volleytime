<script setup lang="ts">
import type { ReportBreakdown, ReportBreakdownDimension } from '@volley-time/shared'
import { computed } from 'vue'

import { BREAKDOWN_OPTIONS, breakdownRows } from '~/utils/desktop-reports'

/**
 * Отчёт «В разрезе» (W-19, 30.3.4): игры, заполняемость, выручка и аренда по тренерам, залам или
 * сериям за выбранный период. Цифры считает сервер; сумма строк выручки равна поступлениям кассы.
 */
const props = defineProps<{
  dimension: ReportBreakdownDimension
  breakdown?: ReportBreakdown | null
  pending: boolean
  error: boolean
}>()
const emit = defineEmits<{ 'update:dimension': [value: ReportBreakdownDimension]; retry: [] }>()

const FIRST_COLUMN: Record<ReportBreakdownDimension, string> = {
  coach: 'Тренер',
  venue: 'Зал',
  series: 'Серия',
}

const view = computed(() => (props.breakdown ? breakdownRows(props.breakdown) : null))
const dimension = computed({
  get: () => props.dimension,
  set: (value: string) => emit('update:dimension', value as ReportBreakdownDimension),
})
</script>

<template>
  <section class="vt-desktop-reports__breakdown" aria-labelledby="reports-breakdown-title">
    <div class="vt-desktop-reports__section-heading">
      <h2 id="reports-breakdown-title">В разрезе</h2>
      <VtSegment v-model="dimension" :options="BREAKDOWN_OPTIONS" label="Разрез отчёта" />
    </div>

    <ErrorState
      v-if="error && !view"
      message="Не удалось загрузить разрез"
      @retry="emit('retry')"
    />
    <SkeletonList v-else-if="!view" :count="3" />
    <p v-else-if="view.rows.length === 0" class="vt-card vt-desktop-reports__empty">
      За период нет событий и денег.
    </p>
    <div v-else class="vt-card vt-desktop-table" :aria-busy="pending">
      <table
        :aria-label="`Отчёт ${BREAKDOWN_OPTIONS.find((o) => o.value === dimension)?.label.toLowerCase()}`"
      >
        <thead>
          <tr>
            <th scope="col" class="vt-cap">{{ FIRST_COLUMN[dimension] }}</th>
            <th scope="col" class="vt-cap vt-desktop-reports__num">Игр</th>
            <th scope="col" class="vt-cap vt-desktop-reports__num">Заполняемость</th>
            <th scope="col" class="vt-cap vt-desktop-reports__num">Выручка</th>
            <th scope="col" class="vt-cap vt-desktop-reports__num">Аренда</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in view.rows" :key="row.key">
            <th
              scope="row"
              class="vt-desktop-table__title"
              :class="{ 'vt-desktop-reports__muted': row.muted }"
            >
              {{ row.label }}
            </th>
            <td class="vt-mono vt-desktop-reports__num">{{ row.events }}</td>
            <td class="vt-mono vt-desktop-reports__num">{{ row.occupancy }}</td>
            <td class="vt-mono vt-desktop-reports__num">{{ row.income }}</td>
            <td class="vt-mono vt-desktop-reports__num">{{ row.rent }}</td>
          </tr>
        </tbody>
        <tfoot>
          <tr>
            <th scope="row">Итого за период</th>
            <td class="vt-mono vt-desktop-reports__num">{{ view.total.events }}</td>
            <td class="vt-mono vt-desktop-reports__num">{{ view.total.occupancy }}</td>
            <td class="vt-mono vt-desktop-reports__num">{{ view.total.income }}</td>
            <td class="vt-mono vt-desktop-reports__num">{{ view.total.rent }}</td>
          </tr>
        </tfoot>
      </table>
      <p v-if="dimension === 'coach'" class="vt-desktop-reports__hint">
        Событие с несколькими тренерами входит в игры каждого, а деньги делятся между ними поровну.
      </p>
    </div>
  </section>
</template>
