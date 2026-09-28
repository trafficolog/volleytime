import { describe, expect, it } from 'vitest'

import {
  canSubmitDesktopLedgerAction,
  desktopBalanceRows,
  DESKTOP_EXPENSE_CATEGORIES,
  DESKTOP_INCOME_CATEGORIES,
  parseDesktopLedgerAmount,
} from './desktop-cashbox'

describe('desktop cashbox', () => {
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
})
