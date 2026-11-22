/**
 * Личные функции игрока (23.1.1, P-12): восемь флагов «Что показывать», по умолчанию включены.
 * Расписание, запись и оплата флагами не управляются и выключены быть не могут.
 */
export const PLAYER_FEATURES = [
  'cal',
  'coach',
  'warmup',
  'self',
  'mvp',
  'teams',
  'streak',
  'wrapped',
] as const

export type PlayerFeature = (typeof PLAYER_FEATURES)[number]
export type PlayerFeatures = Record<PlayerFeature, boolean>

export const isPlayerFeature = (key: string): key is PlayerFeature =>
  (PLAYER_FEATURES as readonly string[]).includes(key)

export function defaultPlayerFeatures(): PlayerFeatures {
  return Object.fromEntries(PLAYER_FEATURES.map((f) => [f, true])) as PlayerFeatures
}

/** Явный выбор игрока поверх значений по умолчанию; неизвестные ключи игнорируются. */
export function resolvePlayerFeatures(
  rows: readonly { feature: string; enabled: boolean }[],
): PlayerFeatures {
  const result = defaultPlayerFeatures()
  for (const row of rows) if (isPlayerFeature(row.feature)) result[row.feature] = row.enabled
  return result
}

/**
 * Какой флаг управляет доставкой типа уведомления в бот (решение владельца 2026-11-22, D-23).
 * У остальных флагов типов уведомлений пока нет; тип без флага (в том числе критичный) — `null`.
 */
const NOTIFICATION_FEATURE: Readonly<Record<string, PlayerFeature>> = {
  reminder_24h: 'cal',
  reminder_2h: 'cal',
  lineup_ready: 'teams',
  mvp_vote: 'mvp',
}

export const featureForNotificationKind = (kind: string): PlayerFeature | null =>
  NOTIFICATION_FEATURE[kind] ?? null
