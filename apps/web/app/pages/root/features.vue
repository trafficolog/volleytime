<script setup lang="ts">
import type { FeatureAnalyticsReport } from '@volley-time/shared'

import { apiErrorStatus } from '~/utils/api-error'
import { featureReportView } from '~/utils/root-features'
import { rootOverviewFailure } from '~/utils/root-overview'

definePageMeta({ layout: 'root', middleware: ['root'] })
useHead({ title: 'Аналитика функций — Root Admin' })

const METRIC_KEYS = [
  'disabledShare',
  'weeklyActive',
  'retention',
  'frequencyOn',
  'frequencyOff',
] as const

const report = ref<FeatureAnalyticsReport | null>(null)
const pending = ref(true)
const failed = ref(false)
let requestSeq = 0

async function load() {
  const seq = ++requestSeq
  failed.value = false
  pending.value = true
  try {
    const data = await $fetch<FeatureAnalyticsReport>('/api/platform/feature-analytics')
    if (seq !== requestSeq) return
    report.value = data
  } catch (e) {
    if (seq !== requestSeq) return
    // Роль root решает API: вошедший не-root — страница ошибки 403, истёкшая сессия — вход
    const reaction = rootOverviewFailure(apiErrorStatus(e))
    if (reaction === 'forbidden') {
      throw createError({
        statusCode: 403,
        statusMessage: 'Forbidden',
        message: 'Нет доступа к разделу',
        fatal: true,
      })
    }
    if (reaction === 'login') await navigateTo('/auth/login')
    failed.value = true
  } finally {
    if (seq === requestSeq) pending.value = false
  }
}

await load()

const view = computed(() => (report.value ? featureReportView(report.value) : null))
</script>

<template>
  <div class="vt-root-features">
    <header class="vt-root-overview__heading">
      <h1 tabindex="-1">
        Аналитика функций <span class="vt-chip vt-chip--solid" aria-label="root">ROOT</span>
      </h1>
      <p class="text-vt-mute-2">Метрики успеха личных функций игрока · вся платформа</p>
    </header>

    <SkeletonList v-if="pending && !view" :count="4" />
    <ErrorState v-else-if="failed && !view" message="Не удалось загрузить отчёт" @retry="load()" />
    <template v-else-if="view">
      <EmptyState
        v-if="!view.rows.length"
        icon="chart"
        title="Данных пока нет"
        description="Отчёт появится, когда игроки начнут пользоваться функциями"
      />
      <div v-else class="vt-card vt-root-features__table-wrap" :aria-busy="pending">
        <table class="vt-root-features__table" data-testid="features-table">
          <caption class="sr-only">
            Метрики восьми функций игрока по платформе
          </caption>
          <thead>
            <tr>
              <th scope="col" class="vt-cap">Функция</th>
              <th scope="col" class="vt-cap" :title="view.hints.disabledShare">Выключили</th>
              <th scope="col" class="vt-cap" :title="view.hints.weeklyActive">
                Активные за 7 дней
              </th>
              <th scope="col" class="vt-cap" :title="view.hints.retention">Удержание 28 дней</th>
              <th scope="col" class="vt-cap" :title="view.hints.frequency">
                Записей на игрока: с функцией
              </th>
              <th scope="col" class="vt-cap" :title="view.hints.frequency">без функции</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in view.rows" :key="row.feature" :data-feature="row.feature">
              <th scope="row">{{ row.label }}</th>
              <td
                v-for="key in METRIC_KEYS"
                :key="key"
                :data-metric="key"
                :data-suppressed="row[key].suppressed"
              >
                <span class="vt-mono vt-root-features__value">{{ row[key].text }}</span>
                <small v-if="row[key].cohort" class="vt-root-features__cohort">
                  {{ row[key].cohort }}
                </small>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <dl class="vt-root-features__hints">
        <div>
          <dt class="vt-cap">Выключили</dt>
          <dd>{{ view.hints.disabledShare }}</dd>
        </div>
        <div>
          <dt class="vt-cap">Активные за 7 дней</dt>
          <dd>{{ view.hints.weeklyActive }}</dd>
        </div>
        <div>
          <dt class="vt-cap">Удержание 28 дней</dt>
          <dd>{{ view.hints.retention }}</dd>
        </div>
        <div>
          <dt class="vt-cap">Записей на игрока</dt>
          <dd>{{ view.hints.frequency }}</dd>
        </div>
      </dl>

      <footer class="vt-root-features__foot">
        <span class="vt-mono" data-testid="features-players">{{ view.playersText }}</span>
        <span>{{ view.footnote }}</span>
        <time class="vt-mono" :datetime="view.generatedAt">Обновлено: {{ view.generatedAt }}</time>
        <p v-if="failed" role="alert" class="vt-root-features__error">Не удалось обновить отчёт</p>
      </footer>
    </template>
  </div>
</template>
