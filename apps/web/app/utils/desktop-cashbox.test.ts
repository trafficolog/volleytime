import { zonedInputToDate } from '@volley-time/shared'
import { describe, expect, it } from 'vitest'

import {
  canSubmitDesktopLedgerAction,
  desktopBalanceRows,
  DESKTOP_EXPENSE_CATEGORIES,
  DESKTOP_INCOME_CATEGORIES,
  parseDesktopLedgerAmount,
  desktopLedgerFormTime,
  balanceAfterEntry,
  monthPeriod,
  signedMoney,
  validateLedgerComment,
} from './desktop-cashbox'

describe('desktop cashbox', () => {
  it('waits for a delayed real timezone and preserves the form instant across differing offsets', async () => {
    const now = new Date('2026-09-28T12:00:00.000Z')
    let timezone: string | null = null
    let resolve!: (zone: string) => void
    const loaded = new Promise<string>((done) => {
      resolve = done
    })
    expect(desktopLedgerFormTime(now, timezone)).toBeNull()
    resolve('America/New_York')
    timezone = await loaded
    const time = desktopLedgerFormTime(now, timezone)!
    expect(time).toEqual({ occurredAt: '2026-09-28T08:00', timezone: 'America/New_York' })
    expect(zonedInputToDate(time.occurredAt, time.timezone).toISOString()).toBe(
      '2026-09-28T12:00:00.000Z',
    )
  })
  it('does not initialize monetary time after a failed timezone load', () => {
    expect(desktopLedgerFormTime(new Date('2026-09-28T12:00:00Z'), null)).toBeNull()
  })
  it.each([
    ['1,25', 125],
    ['1.2', 120],
    ['100000', 10000000],
    ['0.01', 1],
  ])('parses %s without changing minor units', (raw, expected) =>
    expect(parseDesktopLedgerAmount(raw)).toBe(expected),
  )
  it.each(['0', '-1', '1.234', '100000.01', '1e2', '1.', '', 'NaN'])(
    'rejects invalid amount %s',
    (raw) => expect(parseDesktopLedgerAmount(raw)).toBeNull(),
  )
  it('keeps main and foreign currency balances separate', () => {
    expect(
      desktopBalanceRows({
        currency: 'BYN',
        income: 125,
        expense: 25,
        balance: 100,
        byCurrency: {
          BYN: { income: 125, expense: 25, balance: 100 },
          USD: { income: 900, expense: 200, balance: 700 },
        },
      }),
    ).toEqual([
      { currency: 'BYN', income: 125, expense: 25, balance: 100 },
      { currency: 'USD', income: 900, expense: 200, balance: 700 },
    ])
  })
  it('restricts manual options to existing manual categories', () => {
    expect(DESKTOP_INCOME_CATEGORIES).toEqual([
      'contribution',
      'carryover',
      'donation',
      'sponsorship',
      'other_income',
    ])
    expect(DESKTOP_EXPENSE_CATEGORIES).toEqual(['rent', 'equipment', 'salary', 'other'])
  })
  it('blocks stale route, organization and duplicate submits', () => {
    expect(
      canSubmitDesktopLedgerAction('/app/orgs/1/cashbox', '/app/orgs/1/cashbox', 1, 1, false),
    ).toBe(true)
    expect(canSubmitDesktopLedgerAction('/app', '/app/orgs/1/cashbox', 1, 1, false)).toBe(false)
    expect(
      canSubmitDesktopLedgerAction('/app/orgs/1/cashbox', '/app/orgs/1/cashbox', 1, 2, false),
    ).toBe(false)
    expect(
      canSubmitDesktopLedgerAction('/app/orgs/1/cashbox', '/app/orgs/1/cashbox', 1, 1, true),
    ).toBe(false)
  })

  it('computes the month period in the group timezone with an exclusive upper bound', () => {
    expect(monthPeriod('2026-05', 'Europe/Minsk')).toEqual({
      from: '2026-04-30T21:00:00.000Z',
      to: '2026-05-31T21:00:00.000Z',
    })
    expect(monthPeriod('2026-12', 'UTC')).toEqual({
      from: '2026-12-01T00:00:00.000Z',
      to: '2027-01-01T00:00:00.000Z',
    })
    expect(monthPeriod('', 'UTC')).toBeNull()
    expect(monthPeriod('2026-13', 'UTC')).toBeNull()
  })
  it('previews the balance after an entry using the same minor units as the server', () => {
    expect(balanceAfterEntry(24850, 'income', 1500)).toBe(26350)
    expect(balanceAfterEntry(24850, 'expense', 4200)).toBe(20650)
    expect(balanceAfterEntry(100, 'expense', 4200)).toBe(-4100)
  })
  it('signs money for the cash desk', () => {
    expect(signedMoney(24850, 'BYN')).toBe('+248,50 BYN')
    expect(signedMoney(-7000, 'BYN')).toBe('−70,00 BYN')
    expect(signedMoney(0, 'BYN')).toBe('0,00 BYN')
  })
  it('requires a non-blank comment', () => {
    expect(validateLedgerComment('')).toBe('Укажите комментарий к операции.')
    expect(validateLedgerComment('   ')).toBe('Укажите комментарий к операции.')
    expect(validateLedgerComment('Аренда')).toBe('')
  })
})
