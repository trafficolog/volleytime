import { describe, expect, it } from 'vitest'

import { encodePaymentHistoryCursor, parsePaymentHistoryQuery } from './payment-history-query'

describe('payment history query', () => {
  it('defaults to 50 and accepts bounded integer limits and each status', () => {
    expect(parsePaymentHistoryQuery({})).toEqual({ limit: 50 })
    for (const limit of ['1', '50', '100'])
      expect(parsePaymentHistoryQuery({ limit }).limit).toBe(Number(limit))
    for (const status of ['pending', 'succeeded', 'cancelled', 'refunded'])
      expect(parsePaymentHistoryQuery({ status })).toEqual({ limit: 50, status })
  })
  it('round trips an opaque cursor preserving microseconds', () => {
    const cursor = { createdAt: '2026-09-27T12:00:00.123900Z', id: 42 }
    expect(parsePaymentHistoryQuery({ cursor: encodePaymentHistoryCursor(cursor) })).toEqual({
      limit: 50,
      cursor,
    })
  })
  it.each([
    { status: '' },
    { status: 'paid' },
    { status: ['pending', 'refunded'] },
    { limit: ['1', '2'] },
    { cursor: ['a', 'b'] },
    { limit: '0' },
    { limit: '101' },
    { limit: '1.5' },
    { limit: '-1' },
    { limit: '1e2' },
    { limit: ' 1' },
    { limit: 1 },
    { cursor: '' },
    { cursor: 'garbage' },
    { cursor: '{}' },
  ])('rejects invalid or repeated values %j', (query) => {
    expect(() => parsePaymentHistoryQuery(query)).toThrow()
  })
  it.each([
    { createdAt: '2026-09-27T12:00:00.123Z', id: 1 },
    { createdAt: '2026-02-30T12:00:00.123456Z', id: 1 },
    { createdAt: '2026-09-27T25:00:00.123456Z', id: 1 },
    { createdAt: '2026-09-27T12:00:00.123456+00:00', id: 1 },
    { createdAt: '2026-09-27T12:00:00.123456Z', id: 0 },
    { createdAt: '2026-09-27T12:00:00.123456Z', id: '1' },
    { createdAt: '2026-09-27T12:00:00.123456Z', id: 1, extra: true },
  ])('rejects malformed cursor payload %j', (cursor) => {
    expect(() =>
      parsePaymentHistoryQuery({
        cursor: Buffer.from(JSON.stringify(cursor)).toString('base64url'),
      }),
    ).toThrow()
  })
})
