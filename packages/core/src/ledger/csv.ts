import { formatShortDate, formatTime } from '@volley-time/shared'

import type { LedgerHistoryEntry } from './service'

/** Подписи категорий и способов оплаты для выгрузки (те же, что в кабинете и Mini App). */
const CATEGORY_LABELS: Record<string, string> = {
  payment_income: 'Оплата участия',
  rent: 'Аренда',
  equipment: 'Инвентарь',
  refund: 'Возврат',
  salary: 'Зарплата',
  other: 'Прочее',
  contribution: 'Взнос на аренду',
  carryover: 'Перенос остатка',
  donation: 'Донат',
  sponsorship: 'Спонсорство',
  other_income: 'Прочий доход',
}
const METHOD_LABELS: Record<string, string> = {
  cash: 'Наличные',
  transfer: 'Перевод',
  online: 'Онлайн',
}

export const LEDGER_CSV_HEADER = [
  'Дата',
  'Тип',
  'Категория',
  'Описание',
  'Событие',
  'Способ',
  'Сумма',
  'Валюта',
  'Плательщик',
  'Внёс',
] as const

/**
 * Ячейка CSV. Значения, которые таблица прочитает как формулу (`=`, `+`, `-`, `@`, tab, CR),
 * получают ведущий апостроф; поля с разделителем, кавычкой или переводом строки — в кавычках.
 */
export function csvCell(value: string | null | undefined): string {
  if (value === null || value === undefined || value === '') return ''
  let text = value
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`
  return /[;"\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}

/** Минорные единицы → «42,50» (запятая — десятичный разделитель для русской локали Excel). */
export function formatCsvAmount(minor: number): string {
  const whole = Math.floor(minor / 100)
  const cents = String(minor % 100).padStart(2, '0')
  return `${whole},${cents}`
}

function person(p: { name: string | null; telegramUsername: string | null } | null): string {
  if (!p) return ''
  return p.name?.trim() || (p.telegramUsername ? `@${p.telegramUsername}` : '')
}

/**
 * CSV журнала кассы: UTF-8 с BOM, разделитель `;`, строки через CRLF. Сумма всегда положительная,
 * направление — в колонке «Тип». Время — в часовом поясе группы.
 */
export function buildLedgerCsv(entries: readonly LedgerHistoryEntry[], timezone: string): string {
  const lines = [LEDGER_CSV_HEADER.join(';')]
  for (const e of entries) {
    lines.push(
      [
        `${formatShortDate(e.occurredAt, timezone)} ${formatTime(e.occurredAt, timezone)}`,
        e.type === 'income' ? 'Поступление' : 'Расход',
        CATEGORY_LABELS[e.category] ?? e.category,
        e.description,
        e.event?.title ?? null,
        e.method ? (METHOD_LABELS[e.method] ?? e.method) : null,
        formatCsvAmount(e.amount),
        e.currency,
        person(e.payer),
        person(e.author),
      ]
        .map((cell) => csvCell(cell))
        .join(';'),
    )
  }
  return `\uFEFF${lines.join('\r\n')}\r\n`
}
