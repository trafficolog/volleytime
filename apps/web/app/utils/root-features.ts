import type {
  FeatureAnalyticsReport,
  FeatureAnalyticsRow,
  FeatureCohortMetric,
  PlayerFeature,
} from '@volley-time/shared'

import { pluralRu } from '~/utils/desktop-players'

/**
 * Страница «Аналитика функций» Root Admin (23.1.2, P-14, D-25). Только форматирование ответа
 * `GET /api/platform/feature-analytics`: ничего не пересчитывается, скрытые когорты остаются
 * скрытыми («мало данных»), числа не выводятся из соседних значений.
 */
export const FEATURE_LABELS: Record<PlayerFeature, string> = {
  cal: 'Календарь',
  coach: 'AI-тренер',
  warmup: 'Разминка',
  self: 'Самооценка',
  mvp: 'MVP игры',
  teams: 'Составы на игру',
  streak: 'Серии и челленджи',
  wrapped: 'Итоги сезона',
}

export const SUPPRESSED_TEXT = 'мало данных'
const NO_VALUE = '—'

const percent = new Intl.NumberFormat('ru-RU', { style: 'percent', maximumFractionDigits: 0 })
const decimal = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 1 })

export interface MetricCell {
  /** Скрыта по порогу когорты: показываем «мало данных», значения и размера нет. */
  suppressed: boolean
  text: string
  /** Размер когорты, например «12 игроков»; у скрытой — пусто. */
  cohort: string
}

const cohortText = (players: number | null): string =>
  players === null ? '' : `${players} ${pluralRu(players, 'игрок', 'игрока', 'игроков')}`

function cell(metric: FeatureCohortMetric, format: (value: number) => string): MetricCell {
  if (metric.suppressed) return { suppressed: true, text: SUPPRESSED_TEXT, cohort: '' }
  return {
    suppressed: false,
    text: metric.value === null ? NO_VALUE : format(metric.value),
    cohort: cohortText(metric.players),
  }
}

export function featureRowView(row: FeatureAnalyticsRow) {
  return {
    feature: row.feature,
    label: FEATURE_LABELS[row.feature] ?? row.feature,
    disabledShare: cell(row.disabledShare, (v) => percent.format(v)),
    weeklyActive: cell(row.weeklyActive, (v) => String(v)),
    retention: cell(row.retention, (v) => percent.format(v)),
    frequencyOn: cell(row.bookingFrequency.on, (v) => decimal.format(v)),
    frequencyOff: cell(row.bookingFrequency.off, (v) => decimal.format(v)),
  }
}

export function featureReportView(report: FeatureAnalyticsReport) {
  const { windows, minCohort } = report
  const days = (n: number) => `${n} ${pluralRu(n, 'сутки', 'суток', 'суток')}`
  return {
    rows: report.features.map(featureRowView),
    playersText:
      report.players === null
        ? `Игроков платформы: ${SUPPRESSED_TEXT}`
        : `Игроков платформы: ${report.players}`,
    generatedAt: report.generatedAt,
    hints: {
      disabledShare: `Доля игроков платформы, выключивших функцию. Скрыта, если выключивших или включённых меньше ${minCohort}.`,
      weeklyActive: `Игроки с событием функции за последние ${windows.activeDays} суток.`,
      retention: `Когорта: первое открытие функции от ${2 * windows.retentionDays} до ${windows.retentionDays} суток назад. Доля тех, кто записался на игру в следующие ${days(windows.retentionDays)}.`,
      frequency: `Записей на игрока за последние ${days(windows.frequencyDays)}: функция включена и выключена. Обе стороны скрыты, если любая когорта меньше ${minCohort}.`,
    },
    footnote: `Когорты меньше ${minCohort} игроков скрываются: «${SUPPRESSED_TEXT}». Только агрегаты по платформе, без игроков и групп.`,
  }
}
