import { sql } from 'drizzle-orm'
import {
  check,
  index,
  integer,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  unique,
  varchar,
} from 'drizzle-orm/pg-core'

import { organizations } from './organizations'
import { users } from './users'

export const collectionStatusEnum = pgEnum('collection_status', [
  'draft',
  'active',
  'completed',
  'cancelled',
])

/** Иконки сбора из макета (`CAMPAIGN_ICONS`, handoff `screens-contributions.jsx`). */
export const COLLECTION_ICONS = ['ball', 'trophy', 'shirt', 'arena', 'party', 'bus'] as const
export type CollectionIcon = (typeof COLLECTION_ICONS)[number]

/**
 * Сбор вне событий (21.2.4, ADR v3 «Сборы»). Взнос — платёж `payments.collection_id`: жизненный
 * цикл `pending → succeeded | cancelled | refunded` и ровно одна запись кассы на платёж.
 * `target_amount` NULL — сбор без цели. `closed_at` есть ровно у завершённого и отменённого.
 * `UNIQUE (id, organization_id)` — цель составного FK платежа: взнос всегда в сбор своей группы.
 */
export const collections = pgTable(
  'collections',
  {
    id: serial('id').primaryKey(),
    organizationId: integer('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    description: text('description'),
    icon: varchar('icon', { length: 16 }).notNull().default('ball'),
    targetAmount: integer('target_amount'), // minor units
    currency: varchar('currency', { length: 8 }).notNull().default('BYN'),
    status: collectionStatusEnum('status').notNull().default('draft'),
    deadlineAt: timestamp('deadline_at', { withTimezone: true }),
    createdByUserId: integer('created_by_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    closedAt: timestamp('closed_at', { withTimezone: true }),
  },
  (t) => [
    index('collections_org_created_idx').on(t.organizationId, t.createdAt, t.id),
    unique('collections_id_org_uniq').on(t.id, t.organizationId),
    check('collections_target_positive', sql`${t.targetAmount} IS NULL OR ${t.targetAmount} > 0`),
    check(
      'collections_icon_chk',
      sql`${t.icon} IN ('ball', 'trophy', 'shirt', 'arena', 'party', 'bus')`,
    ),
    check('collections_title_chk', sql`char_length(btrim(${t.title})) BETWEEN 1 AND 120`),
    check(
      'collections_closed_at_chk',
      sql`(${t.status} IN ('completed', 'cancelled')) = (${t.closedAt} IS NOT NULL)`,
    ),
  ],
)

export type Collection = typeof collections.$inferSelect
export type NewCollection = typeof collections.$inferInsert
