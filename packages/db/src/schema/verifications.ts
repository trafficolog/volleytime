import { index, pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core'

/** Модель `verification` better-auth (OTP, токены подтверждения). Task 3.9.3. */
export const verifications = pgTable(
  'verifications',
  {
    id: serial('id').primaryKey(),
    identifier: text('identifier').notNull(),
    value: text('value').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('verifications_identifier_idx').on(t.identifier)],
)

export type Verification = typeof verifications.$inferSelect
export type NewVerification = typeof verifications.$inferInsert
