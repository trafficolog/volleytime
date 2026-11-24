import { integer, pgEnum, pgTable, timestamp } from 'drizzle-orm/pg-core'

import { users } from './users'

/**
 * Роли команды платформы (29.3.1, R-15, D-28). Порядок значений — от владельца к аналитику;
 * значения enum не удаляются (правило 6 ADR v3).
 */
export const platformStaffRoleEnum = pgEnum('platform_staff_role', [
  'owner',
  'admin',
  'finance',
  'moderator',
  'support',
  'analyst',
])

/**
 * Команда платформы (29.3.1): одна строка — один человек с одной ролью (первичный ключ —
 * пользователь). Заменяет флаг `users.is_root_admin`: новый код читает только эту таблицу, флаг
 * остаётся в схеме до следующего релиза (expand), чтобы прежний runtime работал в окне отката.
 */
export const platformStaff = pgTable('platform_staff', {
  userId: integer('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  role: platformStaffRoleEnum('role').notNull(),
  invitedBy: integer('invited_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export type PlatformStaffRow = typeof platformStaff.$inferSelect
