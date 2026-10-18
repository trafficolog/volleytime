import { sql } from 'drizzle-orm'
import {
  bigint,
  boolean,
  check,
  pgTable,
  serial,
  smallint,
  text,
  timestamp,
} from 'drizzle-orm/pg-core'

export const users = pgTable(
  'users',
  {
    id: serial('id').primaryKey(),
    email: text('email').unique(),
    emailVerified: boolean('email_verified').notNull().default(false),
    name: text('name'),
    telegramUserId: bigint('telegram_user_id', { mode: 'bigint' }).unique(),
    telegramUsername: text('telegram_username'),
    phone: text('phone'),
    image: text('image'),
    isActive: boolean('is_active').notNull().default(true),
    isRootAdmin: boolean('is_root_admin').notNull().default(false),
    /** Тихие часы (20.3.2): минуты от полуночи в часовом поясе группы-источника; NULL — не заданы. */
    quietHoursStart: smallint('quiet_hours_start'),
    quietHoursEnd: smallint('quiet_hours_end'),
    /** Бот заблокирован пользователем или чат недоступен (20.3.2): доставка пропускается до /start. */
    botBlockedAt: timestamp('bot_blocked_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check(
      'users_quiet_hours_range',
      sql`(${t.quietHoursStart} IS NULL OR ${t.quietHoursStart} BETWEEN 0 AND 1439)
      AND (${t.quietHoursEnd} IS NULL OR ${t.quietHoursEnd} BETWEEN 0 AND 1439)
      AND ((${t.quietHoursStart} IS NULL) = (${t.quietHoursEnd} IS NULL))`,
    ),
  ],
)

export type User = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert
