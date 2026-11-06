import { sql } from 'drizzle-orm'
import {
  boolean,
  check,
  integer,
  pgTable,
  serial,
  timestamp,
  uniqueIndex,
  varchar,
} from 'drizzle-orm/pg-core'

import { organizations } from './organizations'
import { users } from './users'

/**
 * Способы оплаты группы (21.2.11): включение и реквизиты перевода. Только `cash` и `transfer`
 * (как `ledger_entries.method`); ЕРИП и bePaid — фаза 12, в базе их нет. Строки нет — способ
 * включён без реквизитов (поведение до 21.2.11). Полный номер карты не хранится: только
 * последние 4 цифры.
 */
export const organizationPaymentMethods = pgTable(
  'organization_payment_methods',
  {
    id: serial('id').primaryKey(),
    organizationId: integer('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    method: varchar('method', { length: 16 }).notNull(),
    enabled: boolean('enabled').notNull().default(true),
    bank: varchar('bank', { length: 100 }),
    cardLast4: varchar('card_last4', { length: 4 }),
    recipient: varchar('recipient', { length: 100 }),
    updatedByUserId: integer('updated_by_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('org_payment_methods_org_method_uniq').on(t.organizationId, t.method),
    check('org_payment_methods_method_chk', sql`${t.method} IN ('cash', 'transfer')`),
    check(
      'org_payment_methods_card_last4_chk',
      sql`${t.cardLast4} IS NULL OR ${t.cardLast4} ~ '^[0-9]{4}$'`,
    ),
    // реквизиты есть только у перевода
    check(
      'org_payment_methods_details_chk',
      sql`${t.method} = 'transfer' OR (${t.bank} IS NULL AND ${t.cardLast4} IS NULL AND ${t.recipient} IS NULL)`,
    ),
  ],
)

export type OrganizationPaymentMethod = typeof organizationPaymentMethods.$inferSelect
export type NewOrganizationPaymentMethod = typeof organizationPaymentMethods.$inferInsert
