import { z } from 'zod'

import { EVENT_BALANCE_PACKAGE_CODES } from './config'

/** Заявка на покупку: только код пакета из каталога; количество и цена берутся из каталога. */
export const CreatePurchaseRequestInput = z
  .object({ packageCode: z.enum(EVENT_BALANCE_PACKAGE_CODES) })
  .strict()
export type CreatePurchaseRequestInput = z.input<typeof CreatePurchaseRequestInput>

export interface EventBalanceCursor {
  createdAt: string
  id: number
}

const CURSOR_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/

/** Непрозрачный keyset-курсор: base64url от `{ createdAt, id }` (ADR v3, «Пагинация»). */
export function encodeEventBalanceCursor(cursor: EventBalanceCursor): string {
  return Buffer.from(JSON.stringify(cursor)).toString('base64url')
}

function decodeCursor(value: string): EventBalanceCursor | null {
  if (value.length > 256 || !/^[A-Za-z0-9_-]+$/.test(value)) return null
  try {
    const parsed = JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as unknown
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null
    const { createdAt, id, ...rest } = parsed as Record<string, unknown>
    if (Object.keys(rest).length > 0) return null
    if (typeof createdAt !== 'string' || !CURSOR_TIMESTAMP.test(createdAt)) return null
    if (Number.isNaN(Date.parse(createdAt))) return null
    if (typeof id !== 'number' || !Number.isSafeInteger(id) || id <= 0 || id > 2147483647) {
      return null
    }
    return { createdAt, id }
  } catch {
    return null
  }
}

/** `?limit=1..100` (по умолчанию 50) и `?cursor=…`; невалидное → ZodError (422). */
export const ListEventBalanceEntriesQuery = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  cursor: z
    .string()
    .optional()
    .transform((value, ctx) => {
      if (value === undefined) return undefined
      const cursor = decodeCursor(value)
      if (!cursor) {
        ctx.addIssue({ code: 'custom', message: 'Invalid cursor' })
        return z.NEVER
      }
      return cursor
    }),
})
export type ListEventBalanceEntriesQuery = z.input<typeof ListEventBalanceEntriesQuery>
