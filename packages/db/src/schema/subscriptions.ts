import { sql } from 'drizzle-orm'
import { check, index, integer, pgEnum, pgTable, serial, timestamp } from 'drizzle-orm/pg-core'

import { organizations } from './organizations'
import { subscriptionPlans } from './subscription-plans'
import { users } from './users'

export const subscriptionStatusEnum = pgEnum('subscription_status', [
  'pending',
  'active',
  'exhausted',
  'expired',
  'cancelled',
])

export const subscriptions = pgTable(
  'subscriptions',
  {
    id: serial('id').primaryKey(),
    organizationId: integer('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    planId: integer('plan_id')
      .notNull()
      .references(() => subscriptionPlans.id, { onDelete: 'restrict' }),
    totalSessions: integer('total_sessions').notNull(), // snapshot из plan
    usedSessions: integer('used_sessions').notNull().default(0),
    status: subscriptionStatusEnum('status').notNull().default('pending'),
    purchasedAt: timestamp('purchased_at', { withTimezone: true }).notNull().defaultNow(),
    activatedAt: timestamp('activated_at', { withTimezone: true }),
    expiresAt: timestamp('expires_at', { withTimezone: true }), // null = бессрочно
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('subscriptions_user_org_idx').on(t.userId, t.organizationId),
    index('subscriptions_fifo_idx').on(t.userId, t.organizationId, t.status, t.expiresAt),
    check(
      'subscriptions_used_within_total',
      sql`${t.usedSessions} >= 0 AND ${t.usedSessions} <= ${t.totalSessions}`,
    ),
    check('subscriptions_total_positive', sql`${t.totalSessions} > 0`),
  ],
)

export type Subscription = typeof subscriptions.$inferSelect
export type NewSubscription = typeof subscriptions.$inferInsert
