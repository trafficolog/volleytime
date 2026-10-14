import { sql } from 'drizzle-orm'
import {
  boolean,
  check,
  index,
  integer,
  pgEnum,
  pgTable,
  serial,
  smallint,
  text,
  timestamp,
  varchar,
} from 'drizzle-orm/pg-core'

import { eventJoinModeEnum, eventPriceModeEnum } from './event-enums'
import { playerLevelEnum } from './level-enums'
import { users } from './users'

export const orgStatusEnum = pgEnum('organization_status', ['active', 'suspended', 'archived'])
export const memberStatusDefaultEnum = pgEnum('member_status_default', ['active', 'pending'])

export const organizations = pgTable(
  'organizations',
  {
    id: serial('id').primaryKey(),
    slug: varchar('slug', { length: 64 }).notNull().unique(),
    name: text('name').notNull(),
    description: text('description'),
    city: text('city'),
    sportType: varchar('sport_type', { length: 32 }).notNull().default('volleyball'),
    ownerUserId: integer('owner_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    status: orgStatusEnum('status').notNull().default('active'),
    defaultMemberStatus: memberStatusDefaultEnum('default_member_status')
      .notNull()
      .default('active'),
    defaultCurrency: varchar('default_currency', { length: 8 }).notNull().default('BYN'),
    defaultTimezone: varchar('default_timezone', { length: 64 }).notNull().default('Europe/Minsk'),
    publicPageEnabled: boolean('public_page_enabled').notNull().default(false),
    subscriptionsEnabled: boolean('subscriptions_enabled').notNull().default(true),
    // Настройки группы v3 (19.2.2): значения по умолчанию для новых событий
    maxSeatsPerBooking: smallint('max_seats_per_booking').notNull().default(3),
    defaultPriceMode: eventPriceModeEnum('default_price_mode').notNull().default('fixed'),
    defaultJoinMode: eventJoinModeEnum('default_join_mode').notNull().default('open'),
    // политика отмены (D-02): событие копирует значения при создании
    cancellationAllowed: boolean('cancellation_allowed').notNull().default(true),
    // NULL = до начала; 6 — прежний дефолт формы события (R0.7, решение оркестратора)
    cancellationDeadlineHours: integer('cancellation_deadline_hours').default(6),
    seoIndex: boolean('seo_index').notNull().default(false),
    district: text('district'),
    // уровни группы (несколько, 19.2.3); пустой массив — не указаны
    levels: playerLevelEnum('levels')
      .array()
      .notNull()
      .default(sql`'{}'`),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('organizations_owner_idx').on(t.ownerUserId),
    index('organizations_status_idx').on(t.status),
    check(
      'organizations_max_seats_range',
      sql`${t.maxSeatsPerBooking} >= 1 AND ${t.maxSeatsPerBooking} <= 10`,
    ),
    check(
      'organizations_cancellation_deadline_non_negative',
      sql`${t.cancellationDeadlineHours} IS NULL OR ${t.cancellationDeadlineHours} >= 0`,
    ),
  ],
)

export type Organization = typeof organizations.$inferSelect
export type NewOrganization = typeof organizations.$inferInsert
