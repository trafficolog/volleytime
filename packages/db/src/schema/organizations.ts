import {
  boolean,
  index,
  integer,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  varchar,
} from 'drizzle-orm/pg-core'

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
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('organizations_owner_idx').on(t.ownerUserId),
    index('organizations_status_idx').on(t.status),
  ],
)

export type Organization = typeof organizations.$inferSelect
export type NewOrganization = typeof organizations.$inferInsert
