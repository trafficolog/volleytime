import { z } from 'zod'

import { PLAYER_FEATURES, type PlayerFeature } from './features'

/**
 * Аналитика функций игрока (23.1.2, P-14, решение D-25). События открытия и использования функции
 * пишет `POST /api/me/feature-events`; отчёт по платформе отдаёт `GET /api/platform/feature-analytics`
 * (только Root Admin, только агрегаты).
 */
export const FEATURE_EVENT_KINDS = ['open', 'use'] as const
export type FeatureEventKind = (typeof FEATURE_EVENT_KINDS)[number]

/** Тело `POST /api/me/feature-events`: одна из восьми функций и вид события; лишние ключи — 422. */
export const FeatureEventInput = z
  .object({
    feature: z.enum(PLAYER_FEATURES),
    kind: z.enum(FEATURE_EVENT_KINDS),
  })
  .strict()
export type FeatureEventInput = z.infer<typeof FeatureEventInput>

/** События хранятся 180 дней, старше — удаляет планировщик (D-25). */
export const FEATURE_EVENTS_RETENTION_DAYS = 180
/** Когорта меньше этого числа игроков в отчёте скрывается (D-25). */
export const FEATURE_ANALYTICS_MIN_COHORT = 10
/** Окна метрик, сутки: активные, удержание после открытия, частота записей. */
export const FEATURE_ANALYTICS_WINDOWS = {
  activeDays: 7,
  retentionDays: 28,
  frequencyDays: 28,
} as const

/**
 * Метрика по когорте. `players` — размер когорты, `value` — значение; когорта меньше
 * `FEATURE_ANALYTICS_MIN_COHORT` скрывается целиком: `suppressed: true`, оба поля `null`.
 */
export interface FeatureCohortMetric {
  players: number | null
  value: number | null
  suppressed: boolean
}

export interface FeatureAnalyticsRow {
  feature: PlayerFeature
  /**
   * Доля игроков платформы, выключивших функцию (0…1); когорта — все игроки платформы. Скрыта, если
   * выключивших или включённых меньше `FEATURE_ANALYTICS_MIN_COHORT`.
   */
  disabledShare: FeatureCohortMetric
  /** Игроки платформы с событием функции за последние `activeDays` суток; `value` = `players`. */
  weeklyActive: FeatureCohortMetric
  /**
   * Удержание (0…1): когорта — игроки платформы с первым открытием (`open`) в окне
   * [now−56d, now−28d) (= [now − 2·retentionDays, now − retentionDays)); открытия до окна не
   * учитываются. Доля тех, кто записался на игру в живой группе в следующие `retentionDays` суток
   * после первого открытия в окне.
   */
  retention: FeatureCohortMetric
  /**
   * Записей в живых группах на игрока за последние `frequencyDays` суток: функция включена /
   * выключена. Обе стороны скрыты, если любая из них меньше `FEATURE_ANALYTICS_MIN_COHORT`.
   */
  bookingFrequency: { on: FeatureCohortMetric; off: FeatureCohortMetric }
}

/** Ответ `GET /api/platform/feature-analytics`. */
export interface FeatureAnalyticsReport {
  generatedAt: string
  minCohort: number
  retentionDays: number
  windows: typeof FEATURE_ANALYTICS_WINDOWS
  /** Игроки платформы (активное участие в живой группе); `null` при когорте меньше порога. */
  players: number | null
  features: FeatureAnalyticsRow[]
}

/** Скрыть когорту меньше порога: ни размер, ни значение не раскрываются. */
export function cohortMetric(players: number, value: number | null): FeatureCohortMetric {
  if (players < FEATURE_ANALYTICS_MIN_COHORT)
    return { players: null, value: null, suppressed: true }
  return { players, value, suppressed: false }
}
