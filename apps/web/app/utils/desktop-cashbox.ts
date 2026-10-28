import { dateToZonedInput, toMinor, zonedInputToDate } from '@volley-time/shared'

import { formatMoneyRu } from './labels'

export function desktopLedgerFormTime(now: Date, timezone: string | null) {
  return timezone ? { occurredAt: dateToZonedInput(now, timezone), timezone } : null
}

export interface CurrencyBalanceRow {
  currency: string
  income: number
  expense: number
  balance: number
}
export interface LedgerBalance extends CurrencyBalanceRow {
  byCurrency: Record<string, Omit<CurrencyBalanceRow, 'currency'>>
}
export const DESKTOP_INCOME_CATEGORIES = [
  'contribution',
  'carryover',
  'donation',
  'sponsorship',
  'other_income',
] as const
export const DESKTOP_EXPENSE_CATEGORIES = ['rent', 'equipment', 'salary', 'other'] as const

export function parseDesktopLedgerAmount(raw: string): number | null {
  if (!/^\d+(?:[.,]\d{1,2})?$/.test(raw.trim())) return null
  const amount = toMinor(Number(raw.trim().replace(',', '.')))
  return amount > 0 && amount <= 10_000_000 ? amount : null
}
export function desktopBalanceRows(balance: LedgerBalance): CurrencyBalanceRow[] {
  return [
    {
      currency: balance.currency,
      income: balance.income,
      expense: balance.expense,
      balance: balance.balance,
    },
    ...Object.entries(balance.byCurrency)
      .filter(([currency]) => currency !== balance.currency)
      .map(([currency, values]) => ({ currency, ...values })),
  ]
}
export function canSubmitDesktopLedgerAction(
  currentPath: string,
  expectedPath: string,
  expectedOrgId: number,
  currentOrgId: number,
  busy: boolean,
): boolean {
  return !busy && currentPath === expectedPath && expectedOrgId === currentOrgId
}

/** Месяц `YYYY-MM` → границы по дате операции в зоне группы: `from` включительно, `to` — нет. */
export function monthPeriod(month: string, timezone: string): { from: string; to: string } | null {
  const m = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(month)
  if (!m) return null
  const year = Number(m[1]),
    mon = Number(m[2])
  const next = mon === 12 ? `${year + 1}-01` : `${year}-${String(mon + 1).padStart(2, '0')}`
  return {
    from: zonedInputToDate(`${month}-01T00:00`, timezone).toISOString(),
    to: zonedInputToDate(`${next}-01T00:00`, timezone).toISOString(),
  }
}

/** Баланс кассы после записи — подсказка в форме; источник истины — сервер. */
export function balanceAfterEntry(balance: number, kind: 'income' | 'expense', amount: number) {
  return kind === 'income' ? balance + amount : balance - amount
}

/** «+248,50 BYN» / «−70,00 BYN» / «0,00 BYN». */
export function signedMoney(minor: number, currency: string): string {
  if (minor === 0) return formatMoneyRu(0, currency)
  return `${minor > 0 ? '+' : '−'}${formatMoneyRu(Math.abs(minor), currency)}`
}

export function validateLedgerComment(raw: string): string {
  return raw.trim() ? '' : 'Укажите комментарий к операции.'
}
