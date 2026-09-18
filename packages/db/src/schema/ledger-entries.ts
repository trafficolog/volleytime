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
  uniqueIndex,
  varchar,
} from 'drizzle-orm/pg-core'

import { events } from './events'
import { organizations } from './organizations'
import { payments } from './payments'
import { users } from './users'

export const ledgerTypeEnum = pgEnum('ledger_type', ['income', 'expense'])
export const ledgerCategoryEnum = pgEnum('ledger_category', [
  'payment_income',
  'rent',
  'equipment',
  'refund',
  'salary',
  'other',
  // ручной доход (6.8.9, расширено в 6.9.1)
  'donation',
  'sponsorship',
  'other_income',
  'contribution',
  'carryover',
])

export const ledgerEntries = pgTable(
  'ledger_entries',
  {
    id: serial('id').primaryKey(),
    organizationId: integer('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    type: ledgerTypeEnum('type').notNull(),
    category: ledgerCategoryEnum('category').notNull(),
    amount: integer('amount').notNull(), // minor, всегда положительное
    currency: varchar('currency', { length: 8 }).notNull().default('BYN'),
    paymentId: integer('payment_id').references(() => payments.id, { onDelete: 'set null' }),
    eventId: integer('event_id').references(() => events.id, { onDelete: 'set null' }),
    description: text('description'),
    createdByUserId: integer('created_by_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    // дата операции (расход «вчера»), отличается от момента ввода (6.8.7)
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('ledger_org_created_idx').on(t.organizationId, t.createdAt),
    index('ledger_org_type_idx').on(t.organizationId, t.type),
    // один доход и один возврат на платёж (6.8.1): защита от двойного подтверждения/возврата
    uniqueIndex('ledger_income_payment_uniq')
      .on(t.paymentId)
      .where(sql`${t.type} = 'income' AND ${t.paymentId} IS NOT NULL`),
    uniqueIndex('ledger_refund_payment_uniq')
      .on(t.paymentId)
      .where(sql`${t.category} = 'refund' AND ${t.paymentId} IS NOT NULL`),
    check('ledger_entries_amount_positive', sql`${t.amount} > 0`),
  ],
)

export type LedgerEntry = typeof ledgerEntries.$inferSelect
export type NewLedgerEntry = typeof ledgerEntries.$inferInsert
