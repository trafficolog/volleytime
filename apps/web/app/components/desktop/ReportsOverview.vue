<script setup lang="ts">
import type { ManagerReport } from '@volley-time/shared'
import { computed } from 'vue'

import { signedMoney } from '~/utils/desktop-cashbox'
import {
  expenseCategoryRows,
  reportCashBars,
  reportKpis,
  reportPlayerName,
} from '~/utils/desktop-reports'

/** Цифры отчётов за период (W-10, 21.2.7): плитки, касса по неделям, расходы, самые активные. */
const props = defineProps<{ report: ManagerReport }>()

const kpis = computed(() => reportKpis(props.report))
const bars = computed(() => reportCashBars(props.report))
const categories = computed(() => expenseCategoryRows(props.report))
const top = computed(() => props.report.attendance.top.slice(0, 4))
const unitTitle = computed(() =>
  props.report.money.granularity === 'month' ? 'Касса по месяцам' : 'Касса по неделям',
)
</script>

<template>
  <div class="vt-desktop-reports__body">
    <ul class="vt-desktop-reports__kpis" aria-label="Итоги периода">
      <li v-for="kpi in kpis" :key="kpi.label" class="vt-card vt-desktop-reports__kpi">
        <span class="vt-cap">{{ kpi.label }}</span>
        <strong class="vt-mono" :class="`is-${kpi.tone}`">{{ kpi.value }}</strong>
        <small>{{ kpi.caption }}</small>
      </li>
    </ul>

    <div class="vt-desktop-reports__main">
      <section class="vt-card vt-desktop-reports__cash" aria-labelledby="reports-cash-title">
        <div class="vt-desktop-reports__section-heading">
          <h2 id="reports-cash-title">{{ unitTitle }}</h2>
          <span
            class="vt-mono vt-desktop-reports__net"
            :class="{ 'is-negative': report.money.net < 0 }"
          >
            {{ signedMoney(report.money.net, report.currency) }} нетто
          </span>
        </div>
        <p v-if="bars.length === 0" class="vt-desktop-reports__empty">Нет операций за период.</p>
        <ol v-else class="vt-desktop-reports__bars">
          <li v-for="bar in bars" :key="bar.key" :title="bar.title">
            <span class="vt-desktop-reports__bar-track" aria-hidden="true">
              <i class="is-income" :style="{ height: `${bar.incomePercent}%` }" />
              <i class="is-expense" :style="{ height: `${bar.expensePercent}%` }" />
            </span>
            <span class="vt-mono vt-desktop-reports__bar-label">{{ bar.label }}</span>
            <span class="sr-only">{{ bar.title }}</span>
          </li>
        </ol>
        <p class="vt-desktop-reports__legend">
          <span><i class="is-income" aria-hidden="true" /> Поступления</span>
          <span><i class="is-expense" aria-hidden="true" /> Расходы</span>
        </p>
      </section>

      <div class="vt-desktop-reports__side">
        <section class="vt-card" aria-labelledby="reports-expense-title">
          <h2 id="reports-expense-title">Расходы по категориям</h2>
          <p v-if="categories.length === 0" class="vt-desktop-reports__empty">
            Расходов за период нет.
          </p>
          <ul v-else class="vt-desktop-reports__categories">
            <li v-for="row in categories" :key="row.category">
              <span class="vt-desktop-reports__row">
                <span>{{ row.label }}</span>
                <strong class="vt-mono">{{ row.value }}</strong>
              </span>
              <span class="vt-meter" aria-hidden="true"
                ><i :style="{ width: `${row.percent}%`, background: 'var(--vt-rose)' }"
              /></span>
            </li>
          </ul>
        </section>

        <section class="vt-card" aria-labelledby="reports-top-title">
          <h2 id="reports-top-title">Самые активные</h2>
          <p v-if="top.length === 0" class="vt-desktop-reports__empty">
            За период никто не отмечен как пришедший.
          </p>
          <ol v-else class="vt-desktop-reports__top">
            <li v-for="(player, index) in top" :key="player.userId">
              <span class="vt-mono vt-desktop-reports__rank" :class="{ 'is-first': index === 0 }">{{
                index + 1
              }}</span>
              <VtAvatar :name="reportPlayerName(player)" size="sm" />
              <span class="vt-desktop-reports__player">{{ reportPlayerName(player) }}</span>
              <span class="vt-mono">{{ player.visits }} трен.</span>
            </li>
          </ol>
          <p class="vt-desktop-reports__attendance">
            Визитов {{ report.attendance.visits }} · неявок {{ report.attendance.noShows }} · отмен
            {{ report.attendance.cancellations }}
          </p>
        </section>
      </div>
    </div>
  </div>
</template>
