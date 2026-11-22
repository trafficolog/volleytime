import { PLAYER_FEATURES, type PlayerFeature, type PlayerFeatures } from '@volley-time/shared'

import { FEATURE_LABELS } from '~/utils/root-features'

/**
 * Экран «Что показывать» (23.2.3, M-12): только отображение и выбор пресета над флагами
 * `GET/PATCH /api/me/features` (23.1.1). Расписание, запись и оплата флагами не управляются.
 */
export const FEATURE_HINTS: Record<PlayerFeature, string> = {
  cal: 'Вкладка и напоминания об играх',
  coach: 'Советы по тренировкам',
  warmup: 'Разминка перед игрой',
  self: 'Оценка своей формы',
  mvp: 'Голосование после игры',
  teams: 'Состав команд на игру',
  streak: 'Серии посещений и челленджи',
  wrapped: 'Итоги сезона',
}

export const ALWAYS_ON_TEXT = 'Расписание и запись — всегда'

export type FeaturePreset = 'games' | 'all' | 'custom'

export const PRESET_OPTIONS: { value: FeaturePreset; label: string }[] = [
  { value: 'games', label: 'Только игры' },
  { value: 'all', label: 'Всё' },
  { value: 'custom', label: 'Своё' },
]

export interface FeatureRowView {
  feature: PlayerFeature
  label: string
  hint: string
  enabled: boolean
}

export function featureRows(features: PlayerFeatures): FeatureRowView[] {
  return PLAYER_FEATURES.map((feature) => ({
    feature,
    label: FEATURE_LABELS[feature],
    hint: FEATURE_HINTS[feature],
    enabled: features[feature],
  }))
}

/** Раздел профиля «Мои функции»: только включённые. */
export const enabledFeatureRows = (features: PlayerFeatures): FeatureRowView[] =>
  featureRows(features).filter((row) => row.enabled)

/** Все выключены — «Только игры» (M-03), все включены — «Всё», иначе «Своё». */
export function presetOf(features: PlayerFeatures): FeaturePreset {
  const values = PLAYER_FEATURES.map((f) => features[f])
  if (values.every(Boolean)) return 'all'
  if (values.every((v) => !v)) return 'games'
  return 'custom'
}

/** Флаги пресета «Только игры» / «Всё»; «Своё» ничего не меняет (`null`). */
export function presetFlags(preset: FeaturePreset): PlayerFeatures | null {
  if (preset === 'custom') return null
  return Object.fromEntries(PLAYER_FEATURES.map((f) => [f, preset === 'all'])) as PlayerFeatures
}
