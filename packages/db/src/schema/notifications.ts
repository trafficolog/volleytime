import { sql } from 'drizzle-orm'
import {
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core'

import { events } from './events'
import { organizations } from './organizations'
import { users } from './users'

export const notificationTypeEnum = pgEnum('notification_type', [
  'booking_opened',
  'waitlist_offer',
  'waitlist_offer_expired',
  'reminder_24h',
  'reminder_2h',
  'split_settled',
  'payment_confirmed',
  'payment_rejected',
  'lineup_ready',
  'mvp_vote',
  'event_cancelled',
  'organizer_action_required',
])

export const notificationDeliveryStatusEnum = pgEnum('notification_delivery_status', [
  'pending',
  'sent',
  'failed',
  'skipped',
])

/**
 * Хранимая лента уведомлений (20.3.2): один источник для бота, ленты Mini App и ленты кабинета.
 * `UNIQUE (recipient_user_id, dedup_key)` — не больше одного уведомления одного типа на событие.
 * Доставка в Telegram идёт через журнал `scheduled_jobs` (20.3.1); здесь — её итог для получателя.
 * `payload` — данные шаблона (без секретов и initData).
 */
export const notifications = pgTable(
  'notifications',
  {
    id: serial('id').primaryKey(),
    recipientUserId: integer('recipient_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    organizationId: integer('organization_id').references(() => organizations.id, {
      onDelete: 'cascade',
    }),
    eventId: integer('event_id').references(() => events.id, { onDelete: 'cascade' }),
    type: notificationTypeEnum('type').notNull(),
    dedupKey: text('dedup_key').notNull(),
    payload: jsonb('payload').notNull().default({}),
    readAt: timestamp('read_at', { withTimezone: true }),
    deliveryStatus: notificationDeliveryStatusEnum('delivery_status').notNull().default('pending'),
    deliveredAt: timestamp('delivered_at', { withTimezone: true }),
    attempts: integer('attempts').notNull().default(0),
    lastError: text('last_error'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('notifications_recipient_dedup_uniq').on(t.recipientUserId, t.dedupKey),
    index('notifications_feed_idx').on(
      t.recipientUserId,
      sql`${t.createdAt} DESC`,
      sql`${t.id} DESC`,
    ),
    index('notifications_organization_idx').on(t.organizationId),
  ],
)

export type Notification = typeof notifications.$inferSelect
