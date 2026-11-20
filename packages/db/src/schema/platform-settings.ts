import { sql } from 'drizzle-orm'
import { check, integer, jsonb, pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core'

import { users } from './users'

/**
 * Настройки платформы (22.3.1, ADR-22-3-1, D-20): одна строка на ключ из реестра в `packages/shared`.
 * Отсутствие строки = значение по умолчанию из кода (равно поведению до 22.3.1), поэтому сида нет.
 * Значение валидируется реестром Zod при записи и чтении; `version` — оптимистичная блокировка.
 * Секретов в таблице нет по построению: реестр не содержит ключей для токенов и паролей.
 */
export const platformSettings = pgTable(
  'platform_settings',
  {
    id: serial('id').primaryKey(),
    key: text('key').notNull().unique(),
    value: jsonb('value').notNull(),
    version: integer('version').notNull().default(1),
    updatedBy: integer('updated_by').references(() => users.id, { onDelete: 'set null' }),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check('platform_settings_key_format', sql`${t.key} ~ '^[a-z][a-zA-Z]*\\.[a-z][a-zA-Z]*$'`),
    check('platform_settings_version_positive', sql`${t.version} >= 1`),
  ],
)

export type PlatformSettingRow = typeof platformSettings.$inferSelect
