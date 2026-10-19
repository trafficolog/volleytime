import type postgres from 'postgres'

import { rollbackLastMigration } from './rollback'

/**
 * Откат 0030 (20.6.1) отказывает, пока есть живые события со ссылками в обращении. Миграционные
 * тесты старых миграций проверяют свои откаты и должны сначала пройти через 0030: помощник
 * временно переводит живые события в `finished`, откатывает 0030 и возвращает статусы.
 */
export async function rollbackPublicSlug(url: string, sql: postgres.Sql): Promise<string> {
  const live = await sql<{ id: number; status: string }[]>`
    SELECT id, status FROM events WHERE status IN ('published', 'closed') AND ends_at > now()`
  for (const row of live) await sql`UPDATE events SET status = 'finished' WHERE id = ${row.id}`
  try {
    return await rollbackLastMigration(url)
  } finally {
    for (const row of live)
      await sql`UPDATE events SET status = ${row.status}::event_status WHERE id = ${row.id}`
  }
}
