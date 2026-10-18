import {
  and,
  db as defaultDb,
  desc,
  eq,
  inArray,
  isNull,
  notifications,
  sql,
  users,
} from '@volley-time/db'
import type { DbOrTx } from '@volley-time/db'
import { z } from 'zod'

export interface FeedItem {
  id: number
  type: (typeof notifications.$inferSelect)['type']
  organizationId: number | null
  eventId: number | null
  /** Данные шаблона (`template`, `params`) — без секретов и initData. */
  payload: unknown
  readAt: Date | null
  createdAt: Date
  deliveryStatus: (typeof notifications.$inferSelect)['deliveryStatus']
}

export interface FeedPage {
  items: FeedItem[]
  nextCursor: string | null
  unreadCount: number
}

/** Запрос ленты: `GET /api/notifications?organizationId=&limit=&cursor=` (ошибка схемы — 422). */
export const feedQuerySchema = z.object({
  organizationId: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  cursor: z.string().max(100).optional(),
})

/** Отметка прочитанного: перечисленные `ids` или `all` (по желанию в одной группе). */
export const markReadSchema = z
  .object({
    ids: z.array(z.number().int().positive()).min(1).max(200).optional(),
    all: z.literal(true).optional(),
    organizationId: z.number().int().positive().optional(),
  })
  .refine((v) => (v.ids ? !v.all : v.all === true), 'ids or all is required')

/** Тихие часы: минуты от полуночи часового пояса группы-источника; `null` — выключить. */
export const quietHoursSchema = z
  .object({
    start: z.number().int().min(0).max(1439),
    end: z.number().int().min(0).max(1439),
  })
  .nullable()

const DEFAULT_LIMIT = 30
const MAX_LIMIT = 100

/** Курсор ленты: `<created_at ISO>_<id>`; неверный разбирается как отсутствующий. */
export function decodeFeedCursor(cursor: string | undefined): { at: Date; id: number } | null {
  const m = /^(.+)_(\d+)$/.exec(cursor ?? '')
  if (!m) return null
  const at = new Date(m[1]!)
  return Number.isNaN(at.getTime()) ? null : { at, id: Number(m[2]) }
}

/**
 * Лента уведомлений пользователя (20.3.2): один источник для Mini App и кабинета. Доступны только
 * собственные записи — получатель берётся из сессии, не из запроса; `organizationId` лишь сужает
 * выбор (чужой группы просто нет в ленте пользователя).
 */
export const notificationFeedService = {
  async list(
    userId: number,
    opts: { organizationId?: number; limit?: number; cursor?: string; db?: DbOrTx } = {},
  ): Promise<FeedPage> {
    const db = opts.db ?? defaultDb
    const limit = Math.min(MAX_LIMIT, Math.max(1, opts.limit ?? DEFAULT_LIMIT))
    const cursor = decodeFeedCursor(opts.cursor)
    const scope = and(
      eq(notifications.recipientUserId, userId),
      opts.organizationId ? eq(notifications.organizationId, opts.organizationId) : undefined,
    )
    const rows = await db
      .select({
        id: notifications.id,
        type: notifications.type,
        organizationId: notifications.organizationId,
        eventId: notifications.eventId,
        payload: notifications.payload,
        readAt: notifications.readAt,
        createdAt: notifications.createdAt,
        deliveryStatus: notifications.deliveryStatus,
      })
      .from(notifications)
      .where(
        and(
          scope,
          cursor
            ? sql`(${notifications.createdAt}, ${notifications.id}) < (${cursor.at.toISOString()}::timestamptz, ${cursor.id})`
            : undefined,
        ),
      )
      .orderBy(desc(notifications.createdAt), desc(notifications.id))
      .limit(limit + 1)
    const [unread] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(notifications)
      .where(and(scope, isNull(notifications.readAt)))
    const items = rows.slice(0, limit)
    const last = items.at(-1)
    return {
      items,
      nextCursor: rows.length > limit && last ? `${last.createdAt.toISOString()}_${last.id}` : null,
      unreadCount: unread?.n ?? 0,
    }
  },

  /**
   * Отметить прочитанными свои уведомления: перечисленные `ids` или все (`all`), по желанию в одной
   * группе. Чужие и несуществующие идентификаторы молча не затрагиваются. Повтор — no-op.
   */
  async markRead(
    userId: number,
    target: { ids?: number[]; all?: boolean; organizationId?: number },
    db: DbOrTx = defaultDb,
  ): Promise<number> {
    if (!target.all && !target.ids?.length) return 0
    const rows = await db
      .update(notifications)
      .set({ readAt: new Date() })
      .where(
        and(
          eq(notifications.recipientUserId, userId),
          isNull(notifications.readAt),
          target.all
            ? target.organizationId
              ? eq(notifications.organizationId, target.organizationId)
              : undefined
            : inArray(notifications.id, target.ids!),
        ),
      )
      .returning({ id: notifications.id })
    return rows.length
  },

  /**
   * Тихие часы пользователя (ADR v3): окно в минутах от полуночи часового пояса группы-источника.
   * Критичные уведомления (место из очереди, оплата, отмена события) окном не откладываются.
   */
  async setQuietHours(
    userId: number,
    value: z.infer<typeof quietHoursSchema>,
    db: DbOrTx = defaultDb,
  ): Promise<{ start: number; end: number } | null> {
    const parsed = quietHoursSchema.parse(value)
    await db
      .update(users)
      .set({
        quietHoursStart: parsed?.start ?? null,
        quietHoursEnd: parsed?.end ?? null,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))
    return parsed
  },

  async getQuietHours(
    userId: number,
    db: DbOrTx = defaultDb,
  ): Promise<{ start: number; end: number } | null> {
    const [u] = await db
      .select({ start: users.quietHoursStart, end: users.quietHoursEnd })
      .from(users)
      .where(eq(users.id, userId))
    return u && u.start !== null && u.end !== null ? { start: u.start, end: u.end } : null
  },
}
