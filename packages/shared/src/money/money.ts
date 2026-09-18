/**
 * Денежные суммы хранятся в минимальных единицах (minor, integer), напр. 500 = 5.00 BYN.
 * Используется в событиях/оплатах/абонементах (Phase 5/6) и credits (Phase 7).
 */

const MINOR_PER_MAJOR = 100

/** Мажорные единицы (5.00) → минорные integer (500). Округляет до целого минора. */
export function toMinor(major: number): number {
  if (major < 0) throw new Error('money: amount must be non-negative')
  return Math.round(major * MINOR_PER_MAJOR)
}

/** Минорные integer (500) → мажорные (5.00). */
export function toMajor(minor: number): number {
  return minor / MINOR_PER_MAJOR
}

/** Форматирует минорную сумму для UI. 0 → "Бесплатно". */
export function formatMoney(minor: number, currency: string): string {
  if (minor === 0) return 'Бесплатно'
  return `${toMajor(minor).toFixed(2)} ${currency}`
}
