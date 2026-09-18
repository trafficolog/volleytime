import { sql } from 'drizzle-orm'

import { db } from './client'

/**
 * Очищает все пользовательские таблицы (для изоляции интеграционных тестов).
 * CASCADE удалит связанные записи (accounts, sessions).
 * Только для тестов: импортировать из `@volley-time/db/test-utils` (Task 3.9.9).
 */
export async function truncateAll(): Promise<void> {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('truncateAll is test-only and forbidden in production')
  }
  await db.execute(sql`TRUNCATE TABLE users RESTART IDENTITY CASCADE`)
}
