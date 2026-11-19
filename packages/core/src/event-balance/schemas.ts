import { z } from 'zod'

/** Код пакета каталога (22.2.1): строчные латинские буквы, цифры и `_`. */
export const EVENT_BALANCE_PACKAGE_CODE_PATTERN = /^[a-z0-9_]{1,64}$/

/**
 * Заявка на покупку: код пакета из каталога БД; количество и цена берутся из пакета. Неизвестный
 * код, прошедший шаблон, — 409 `event_balance.package_unavailable` (сервис), а не 422.
 */
export const CreatePurchaseRequestInput = z
  .object({ packageCode: z.string().regex(EVENT_BALANCE_PACKAGE_CODE_PATTERN) })
  .strict()
export type CreatePurchaseRequestInput = z.input<typeof CreatePurchaseRequestInput>

const Units = z.number().int().min(1).max(10_000)
/** minor units; граница как у сумм кассы и цены зала (ADR 21.4.13). */
const Amount = z.number().int().min(0).max(10_000_000)
const Badge = z.enum(['popular', 'discount', 'best_price']).nullable()
const SortOrder = z.number().int().min(0).max(10_000)
const Version = z.number().int().min(1).max(2_147_483_647)

/** Создание пакета root: код генерирует сервер; по умолчанию черновик. */
export const CreatePackageInput = z
  .object({
    units: Units,
    amount: Amount,
    currency: z.literal('BYN').default('BYN'),
    badge: Badge.default(null),
    visible: z.boolean().default(false),
    sortOrder: SortOrder.default(0),
  })
  .strict()
export type CreatePackageInput = z.input<typeof CreatePackageInput>

/** «Дублировать»: новый черновик; другое количество и цена — необязательно. */
export const DuplicatePackageInput = z
  .object({ units: Units.optional(), amount: Amount.optional() })
  .strict()
export type DuplicatePackageInput = z.input<typeof DuplicatePackageInput>

/** Правка: только цена, бейдж, видимость и порядок; `units`, `currency`, `code` — 422. */
export const UpdatePackageInput = z
  .object({
    version: Version,
    amount: Amount.optional(),
    badge: Badge.optional(),
    visible: z.boolean().optional(),
    sortOrder: SortOrder.optional(),
  })
  .strict()
export type UpdatePackageInput = z.input<typeof UpdatePackageInput>

export const ArchivePackageInput = z.object({ version: Version }).strict()
export type ArchivePackageInput = z.input<typeof ArchivePackageInput>

const CURSOR_ID = z.coerce.number().int().positive().max(2_147_483_647)
export const PackageHistoryQuery = z.object({
  cursor: CURSOR_ID.optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
})
export type PackageHistoryQuery = z.input<typeof PackageHistoryQuery>

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
