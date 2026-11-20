import type { PlatformPurchaseRequestRow } from '@volley-time/shared'
import { describe, expect, it } from 'vitest'

import {
  decisionErrorMessage,
  exportHref,
  paymentRowView,
  periodRange,
  rejectReasonError,
  totalsLabel,
} from './root-payments'

const ROW: PlatformPurchaseRequestRow = {
  id: 7,
  organization: { id: 3, name: 'VolleyTime Минск' },
  units: 50,
  amount: 4500,
  currency: 'BYN',
  status: 'pending',
  createdAt: '2026-11-19T09:02:00.000Z',
  decidedAt: null,
  decidedBy: null,
  decisionComment: null,
  requestedBy: { id: 2, name: 'Аня' },
}

describe('periodRange', () => {
  it('builds [from, to) by Minsk days (UTC+3) for month, previous month and 30 days', () => {
    const now = new Date('2026-11-20T12:30:00.000Z')
    expect(periodRange('month', now)).toEqual({
      from: '2026-10-31T21:00:00.000Z',
      to: '2026-11-30T21:00:00.000Z',
    })
    expect(periodRange('prev', now)).toEqual({
      from: '2026-09-30T21:00:00.000Z',
      to: '2026-10-31T21:00:00.000Z',
    })
    expect(periodRange('30d', now)).toEqual({
      from: '2026-10-21T21:00:00.000Z',
      to: '2026-11-20T21:00:00.000Z',
    })
    expect(periodRange('all', now)).toEqual({})
  })

  it('uses the Minsk date near midnight UTC and across the year boundary', () => {
    // 22:30 UTC 31 декабря — в Минске уже 1 января
    const now = new Date('2026-12-31T22:30:00.000Z')
    expect(periodRange('month', now)).toEqual({
      from: '2026-12-31T21:00:00.000Z',
      to: '2027-01-31T21:00:00.000Z',
    })
    expect(periodRange('prev', now).from).toBe('2026-11-30T21:00:00.000Z')
  })
})

describe('exportHref', () => {
  it('encodes the period into the export URL', () => {
    expect(exportHref({})).toBe('/api/platform/event-balance/purchase-requests/export')
    expect(exportHref({ from: '2026-11-01T00:00:00.000Z', to: '2026-12-01T00:00:00.000Z' })).toBe(
      '/api/platform/event-balance/purchase-requests/export?from=2026-11-01T00%3A00%3A00.000Z&to=2026-12-01T00%3A00%3A00.000Z',
    )
  })
})

describe('rejectReasonError', () => {
  it('requires 3..500 characters after trimming', () => {
    expect(rejectReasonError('  ')).toBe('Укажите причину отклонения')
    expect(rejectReasonError('ok')).toBe('Причина — не короче 3 символов')
    expect(rejectReasonError('x'.repeat(501))).toBe('Причина — не длиннее 500 символов')
    expect(rejectReasonError(' Нет оплаты ')).toBeNull()
  })
})

describe('decisionErrorMessage', () => {
  it('maps API codes to wording', () => {
    expect(decisionErrorMessage('purchase_request.not_pending')).toMatch(/уже обработана/)
    expect(decisionErrorMessage('purchase_request.not_found')).toMatch(/не найдена/)
    expect(decisionErrorMessage('platform.purchase_org_deleted')).toMatch(/удалена/)
    expect(decisionErrorMessage(undefined)).toMatch(/Не удалось/)
  })
})

describe('paymentRowView', () => {
  it('formats units in events (D-10), money and status', () => {
    const v = paymentRowView(ROW, 'Europe/Minsk')
    expect(v.units).toBe('+50 событий')
    expect(v.amount).toBe('45,00 BYN')
    expect(v.status).toBe('Ждёт решения')
    expect(v.pending).toBe(true)
    expect(v.decision).toBe('')
    const rejected = paymentRowView(
      {
        ...ROW,
        status: 'rejected',
        decidedAt: '2026-11-19T10:00:00.000Z',
        decidedBy: { id: 1, name: 'Root' },
        decisionComment: 'Нет оплаты',
      },
      'Europe/Minsk',
    )
    expect(rejected.status).toBe('Отклонена')
    expect(rejected.pending).toBe(false)
    expect(rejected.decision).toBe('Root: Нет оплаты')
  })
})

describe('totalsLabel', () => {
  it('joins currencies; empty is zero', () => {
    expect(totalsLabel([])).toBe('0,00 BYN')
    expect(
      totalsLabel([{ currency: 'BYN', amount: 123456, count: 2, units: 10 }]).replace(/\s/g, ' '),
    ).toBe('1 234,56 BYN')
  })
})
