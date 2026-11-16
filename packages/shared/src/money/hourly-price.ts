/**
 * Цена за час зала (21.4.13, DEF-23, ADR-21-4-13): минимальные единицы валюты группы, `null` —
 * не указана. Справочная величина: в цену события, кассу и отчёты не входит.
 */

import { toMinor } from './money'

/** Верхняя граница в минимальных единицах (100 000,00), как CHECK `venues_hourly_price_range`. */
export const VENUE_HOURLY_PRICE_MAX = 10_000_000

export type HourlyPriceInput = { ok: true; value: number | null } | { ok: false }

/**
 * Поле формы «Цена за час» (мажорные единицы, `,` или `.`, до двух знаков) → минорные единицы.
 * Пустое поле — `null`; `0` — явная бесплатная цена. `toMinor` округляет до целой копейки и
 * снимает погрешность двоичной дроби (`0.29 * 100`).
 */
export function parseHourlyPriceInput(raw: string): HourlyPriceInput {
  const text = raw.trim()
  if (text === '') return { ok: true, value: null }
  if (!/^\d+(?:[.,]\d{1,2})?$/.test(text)) return { ok: false }
  const value = toMinor(Number(text.replace(',', '.')))
  return value <= VENUE_HOURLY_PRICE_MAX ? { ok: true, value } : { ok: false }
}

/** «15 BYN/ч», «15,50 BYN/ч», «0 BYN/ч»; цена не указана — `null`. */
export function formatHourlyPrice(
  minor: number | null | undefined,
  currency: string,
): string | null {
  if (minor === null || minor === undefined) return null
  const digits = minor % 100 === 0 ? 0 : 2
  const amount = new Intl.NumberFormat('ru-RU', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(minor / 100)
  return `${amount} ${currency}/ч`
}
