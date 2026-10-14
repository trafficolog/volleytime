/**
 * Конфигурация баланса событий (20.2.1). Каталог пакетов до 22.2.1 — конфигурация приложения
 * (ADR v3): заявка хранит снимок, поэтому смена каталога не меняет старые заявки.
 * Цены — handoff v3 (10 → 50 Br, 30 → 120 Br, 100 → 350 Br), minor units BYN.
 */
export const EVENT_BALANCE_PACKAGES = [
  { code: 'events_10', units: 10, amount: 5_000, currency: 'BYN', popular: false },
  { code: 'events_30', units: 30, amount: 12_000, currency: 'BYN', popular: true },
  { code: 'events_100', units: 100, amount: 35_000, currency: 'BYN', popular: false },
] as const

export type EventBalancePackage = (typeof EVENT_BALANCE_PACKAGES)[number]
export type EventBalancePackageCode = EventBalancePackage['code']
export const EVENT_BALANCE_PACKAGE_CODES = EVENT_BALANCE_PACKAGES.map((p) => p.code) as [
  EventBalancePackageCode,
  ...EventBalancePackageCode[],
]

/**
 * Порог «баланс заканчивается»: при остатке не больше порога кабинет предупреждает и предлагает
 * пополнение. В макете (handoff, уведомление «Мало событий») предупреждение показано при остатке 8.
 */
export const EVENT_BALANCE_LOW_THRESHOLD = 10

/**
 * Выключатель списания (ADR v3, правило совместимости 5): включается после выкладки релиза,
 * только точным значением `true`. Выключенный не списывает при публикации; возврат при отмене
 * от него не зависит — он требует существующего списания.
 */
export function isEventBalanceEnforced(value: string | undefined): boolean {
  return value === 'true'
}
