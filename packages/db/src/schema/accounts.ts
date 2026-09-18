import { integer, pgTable, serial, text, timestamp, unique } from 'drizzle-orm/pg-core'

import { users } from './users'

export const accounts = pgTable(
  'accounts',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    providerId: text('provider_id').notNull(), // 'email', 'telegram'
    accountId: text('account_id').notNull(), // email-адрес или telegram_user_id как string
    // поля модели account better-auth (Task 3.9.3); для email-OTP/Telegram не заполняются
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    idToken: text('id_token'),
    accessTokenExpiresAt: timestamp('access_token_expires_at', { withTimezone: true }),
    refreshTokenExpiresAt: timestamp('refresh_token_expires_at', { withTimezone: true }),
    scope: text('scope'),
    password: text('password'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique().on(t.providerId, t.accountId)],
)

export type Account = typeof accounts.$inferSelect
export type NewAccount = typeof accounts.$inferInsert
