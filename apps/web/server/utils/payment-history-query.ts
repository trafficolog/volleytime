import type { PaymentHistoryCursor } from '@volley-time/core'
import type { Payment } from '@volley-time/db'

function invalid(): never {
  throw new Error('Invalid payment history query')
}

function validTimestamp(value: unknown): value is string {
  if (typeof value !== 'string') return false
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})\.\d{6}Z$/.exec(value)
  if (!match) return false
  const [year, month, day, hour, minute, second] = match.slice(1).map(Number) as [
    number,
    number,
    number,
    number,
    number,
    number,
  ]
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
  return (
    year > 0 &&
    month >= 1 &&
    month <= 12 &&
    day >= 1 &&
    day <= days[month - 1]! &&
    hour < 24 &&
    minute < 60 &&
    second < 60
  )
}

export function encodePaymentHistoryCursor(cursor: PaymentHistoryCursor): string {
  return Buffer.from(JSON.stringify(cursor)).toString('base64url')
}

export function parsePaymentHistoryQuery(query: Record<string, unknown>): {
  status?: Payment['status']
  limit: number
  cursor?: PaymentHistoryCursor
} {
  const result: { status?: Payment['status']; limit: number; cursor?: PaymentHistoryCursor } = {
    limit: 50,
  }
  if (query.status !== undefined) {
    if (
      typeof query.status !== 'string' ||
      !['pending', 'succeeded', 'cancelled', 'refunded'].includes(query.status)
    )
      invalid()
    result.status = query.status as Payment['status']
  }
  if (query.limit !== undefined) {
    if (typeof query.limit !== 'string' || !/^[1-9]\d{0,2}$/.test(query.limit)) invalid()
    const limit = Number(query.limit)
    if (limit > 100) invalid()
    result.limit = limit
  }
  if (query.cursor !== undefined) {
    if (
      typeof query.cursor !== 'string' ||
      query.cursor.length > 256 ||
      !/^[A-Za-z0-9_-]+$/.test(query.cursor)
    )
      invalid()
    const decoded = Buffer.from(query.cursor, 'base64url')
    if (decoded.toString('base64url') !== query.cursor) invalid()
    let value: unknown
    try {
      value = JSON.parse(decoded.toString('utf8'))
    } catch {
      invalid()
    }
    if (!value || typeof value !== 'object' || Array.isArray(value)) invalid()
    const cursor = value as Record<string, unknown>
    if (
      Object.keys(cursor).sort().join(',') !== 'createdAt,id' ||
      !validTimestamp(cursor.createdAt) ||
      typeof cursor.id !== 'number' ||
      !Number.isSafeInteger(cursor.id) ||
      cursor.id <= 0 ||
      cursor.id > 2147483647
    )
      invalid()
    result.cursor = { createdAt: cursor.createdAt, id: cursor.id }
  }
  return result
}
