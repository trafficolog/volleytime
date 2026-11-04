import postgres from 'postgres'

import { rollbackLastMigration } from './rollback'

/**
 * Откат 0032 (21.2.4) отказывает, пока есть сборы. Миграционные тесты старых миграций откатывают
 * свои шаги через этот помощник: он проходит путь оператора из `rollback/0032_collections.sql`
 * (снять связь платежей со сбором, удалить сборы; платежи и касса остаются), откатывает 0032 и
 * возвращает тег. Следующая миграция добавляет свой шаг сюда, а не в каждый тест.
 */
export async function rollbackCollections(url: string): Promise<string> {
  const sql = postgres(url, { max: 1 })
  try {
    await sql.begin(async (tx) => {
      await tx`UPDATE payments SET collection_id = NULL WHERE collection_id IS NOT NULL`
      await tx`DELETE FROM collections`
    })
  } finally {
    await sql.end()
  }
  const tag = await rollbackLastMigration(url)
  if (tag !== '0032_collections') throw new Error(`expected 0032 to roll back first, got ${tag}`)
  return tag
}

/**
 * Откат 0031 (20.3.4) отказывает, пока в группах есть привязанные Telegram-чаты. Миграционные
 * тесты старых миграций проверяют откаты на базах без привязок и сначала проходят через 0031:
 * помощник откатывает её и возвращает тег. Новая миграция добавляет такой шаг сюда, а не в каждый
 * тест (как 0030 ниже).
 */
export async function rollbackTelegramChatLink(url: string): Promise<string> {
  await rollbackCollections(url) // 21.2.4: новая миграция откатывается первой
  const tag = await rollbackLastMigration(url)
  if (tag !== '0031_telegram_chat_link')
    throw new Error(`expected 0031 to roll back first, got ${tag}`)
  return tag
}

/**
 * Откат 0030 (20.6.1) отказывает, пока есть живые события со ссылками в обращении. Миграционные
 * тесты старых миграций проверяют свои откаты и должны сначала пройти через 0030: помощник
 * временно переводит живые события в `finished`, откатывает 0030 и возвращает статусы.
 */
export async function rollbackPublicSlug(url: string, sql: postgres.Sql): Promise<string> {
  await rollbackTelegramChatLink(url) // 20.3.4: новая миграция откатывается первой
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
