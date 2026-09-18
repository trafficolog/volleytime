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
  varchar,
} from 'drizzle-orm/pg-core'

import { organizations } from './organizations'

export const planStatusEnum = pgEnum('plan_status', ['active', 'archived'])

export const subscriptionPlans = pgTable(
  'subscription_plans',
  {
    id: serial('id').primaryKey(),
    organizationId: integer('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    description: text('description'),
    totalSessions: integer('total_sessions').notNull(),
    validityDays: integer('validity_days'), // null = бессрочно
    price: integer('price').notNull().default(0), // minor units
    currency: varchar('currency', { length: 8 }).notNull().default('BYN'),
    status: planStatusEnum('status').notNull().default('active'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('subscription_plans_org_idx').on(t.organizationId),
    check('subscription_plans_sessions_positive', sql`${t.totalSessions} > 0`),
    check('subscription_plans_price_non_negative', sql`${t.price} >= 0`),
  ],
)

export type SubscriptionPlan = typeof subscriptionPlans.$inferSelect
export type NewSubscriptionPlan = typeof subscriptionPlans.$inferInsert
