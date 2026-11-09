import { sql } from 'drizzle-orm'
import { check, customType, integer, pgTable, timestamp, varchar } from 'drizzle-orm/pg-core'

import { organizations } from './organizations'
import { users } from './users'

/** `bytea` как Node `Buffer` (драйвер postgres.js отдаёт и принимает Buffer). */
const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType() {
    return 'bytea'
  },
})

/** Верхняя граница логотипа в байтах (21.2.16): 1 МБ. Дублируется CHECK в базе. */
export const ORGANIZATION_LOGO_MAX_BYTES = 1_048_576
export const ORGANIZATION_LOGO_MIME_TYPES = ['image/png', 'image/jpeg'] as const

/**
 * Логотип группы (21.2.16, W-11): файл хранится в Postgres, не в файловой системе. Одна строка
 * на группу (PK = `organization_id`). Только PNG и JPEG; SVG не хранится. Тип и размер
 * проверяет сервер по содержимому до записи, CHECK — страховка. Отдельная таблица, чтобы
 * выборки `organizations` не тянули байты; признак «логотип есть» и версия —
 * `organizations.logo_updated_at`.
 */
export const organizationLogos = pgTable(
  'organization_logos',
  {
    organizationId: integer('organization_id')
      .primaryKey()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    data: bytea('data').notNull(),
    mimeType: varchar('mime_type', { length: 16 }).notNull(),
    sizeBytes: integer('size_bytes').notNull(),
    updatedByUserId: integer('updated_by_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check('organization_logos_mime_chk', sql`${t.mimeType} IN ('image/png', 'image/jpeg')`),
    check('organization_logos_size_chk', sql`${t.sizeBytes} BETWEEN 1 AND 1048576`),
    check('organization_logos_data_size_chk', sql`octet_length(${t.data}) = ${t.sizeBytes}`),
  ],
)

export type OrganizationLogo = typeof organizationLogos.$inferSelect
