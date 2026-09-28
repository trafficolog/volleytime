import { dateToZonedInput, toMinor } from '@volley-time/shared'

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
