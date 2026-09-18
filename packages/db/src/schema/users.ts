import { bigint, boolean, pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core'

export const users = pgTable('users', {
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
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export type User = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert
