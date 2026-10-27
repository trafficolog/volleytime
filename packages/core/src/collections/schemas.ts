import { COLLECTION_ICONS } from '@volley-time/db'
import { z } from 'zod'

const MAX_AMOUNT = 2_147_483_647
/** Потолок одного взноса: 100 000 в основной единице валюты (minor units). */
export const MAX_CONTRIBUTION_AMOUNT = 10_000_000

const Title = z.string().trim().min(1).max(120)
const Description = z.string().trim().max(2000)
const FutureDate = z.coerce
  .date()
  .refine((d) => d.getTime() > Date.now(), 'Deadline must be in the future')

/** POST …/collections. Валюта — валюта группы; статус по умолчанию — активный (виден игрокам). */
export const CreateCollectionInput = z
  .object({
    title: Title,
    description: Description.nullable().optional(),
    icon: z.enum(COLLECTION_ICONS).default('ball'),
    targetAmount: z.number().int().min(1).max(MAX_AMOUNT).nullable().default(null),
    deadlineAt: FutureDate.nullable().optional(),
    status: z.enum(['draft', 'active']).default('active'),
  })
  .strict()
export type CreateCollectionInput = z.input<typeof CreateCollectionInput>

/** PATCH …/collections/{id}: поля сбора; `status: 'active'` публикует черновик. */
export const UpdateCollectionInput = z
  .object({
    title: Title.optional(),
    description: Description.nullable().optional(),
    icon: z.enum(COLLECTION_ICONS).optional(),
    targetAmount: z.number().int().min(1).max(MAX_AMOUNT).nullable().optional(),
    deadlineAt: FutureDate.nullable().optional(),
    status: z.literal('active').optional(),
  })
  .strict()
export type UpdateCollectionInput = z.input<typeof UpdateCollectionInput>

/** POST …/collections/{id}/contributions: свой взнос (обещание до подтверждения организатором). */
export const ContributeInput = z
  .object({
    amount: z.number().int().min(1).max(MAX_CONTRIBUTION_AMOUNT),
    method: z.enum(['cash', 'transfer']),
  })
  .strict()
export type ContributeInput = z.input<typeof ContributeInput>

export interface CollectionCursor {
  createdAt: string
  id: number
}

const CURSOR_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/

/** Непрозрачный keyset-курсор: base64url от `{ createdAt, id }` (ADR v3, «Пагинация»). */
export function encodeCollectionCursor(cursor: CollectionCursor): string {
  return Buffer.from(JSON.stringify(cursor)).toString('base64url')
}

function decodeCursor(value: string): CollectionCursor | null {
  if (value.length > 256 || !/^[A-Za-z0-9_-]+$/.test(value)) return null
  try {
    const parsed = JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as unknown
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null
    const { createdAt, id, ...rest } = parsed as Record<string, unknown>
    if (Object.keys(rest).length > 0) return null
    if (typeof createdAt !== 'string' || !CURSOR_TIMESTAMP.test(createdAt)) return null
    if (Number.isNaN(Date.parse(createdAt))) return null
    if (typeof id !== 'number' || !Number.isSafeInteger(id) || id <= 0 || id > MAX_AMOUNT) {
      return null
    }
    return { createdAt, id }
  } catch {
    return null
  }
}

/** `?limit=1..100` (по умолчанию 50) и `?cursor=…`; невалидное → ZodError (422). */
export const ListCollectionsQuery = z.object({
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
export type ListCollectionsQuery = z.input<typeof ListCollectionsQuery>
