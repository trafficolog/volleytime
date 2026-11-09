import postgres from 'postgres'

import { rollbackLastMigration } from './rollback'

/**
 * Откат 0038 (21.2.16) отказывает, пока есть логотип или короткая ссылка группы; тесты старых
 * миграций работают на базах без них. Помощник откатывает 0038 и возвращает тег; следующая
 * миграция добавляет свой шаг сюда.
 */
export async function rollbackLogoShortLink(url: string): Promise<string> {
  const tag = await rollbackLastMigration(url)
  if (tag !== '0038_organization_logo_short_link')
    throw new Error(`expected 0038 to roll back first, got ${tag}`)
  return tag
}

/**
 * Откат 0037 (21.2.14) отказывает, пока в группах выключены напоминания; тесты старых миграций
 * работают на базах без выключенных типов. Помощник откатывает 0037 и возвращает тег; следующая
 * миграция добавляет свой шаг сюда.
 */
export async function rollbackNotificationSettings(url: string): Promise<string> {
  await rollbackLogoShortLink(url) // 21.2.16: новая миграция откатывается первой
  const tag = await rollbackLastMigration(url)
  if (tag !== '0037_org_notification_settings')
    throw new Error(`expected 0037 to roll back first, got ${tag}`)
  return tag
}

/**
 * Откат 0036 (21.2.11) отказывает, пока есть выключенные способы оплаты или реквизиты; тесты
 * старых миграций работают на базах без них. Помощник откатывает 0036 и возвращает тег;
 * следующая миграция добавляет свой шаг сюда.
 */
export async function rollbackPaymentMethods(url: string): Promise<string> {
  await rollbackNotificationSettings(url) // 21.2.14: новая миграция откатывается первой
  const tag = await rollbackLastMigration(url)
  if (tag !== '0036_organization_payment_methods')
    throw new Error(`expected 0036 to roll back first, got ${tag}`)
  return tag
}

/**
 * Откат 0035 (21.2.12) отказывает, пока есть слоты расписания; тесты старых миграций работают на
 * базах без слотов. Помощник откатывает 0035 и возвращает тег; следующая миграция добавляет свой
 * шаг сюда.
 */
export async function rollbackScheduleSlots(url: string): Promise<string> {
  await rollbackPaymentMethods(url) // 21.2.11: новая миграция откатывается первой
  const tag = await rollbackLastMigration(url)
  if (tag !== '0035_schedule_slots') throw new Error(`expected 0035 to roll back first, got ${tag}`)
  return tag
}

/**
 * Откат 0034 (21.2.22) отказывает, пока у участников задано амплуа; тесты старых миграций работают
 * на базах без амплуа. Помощник откатывает 0034 и возвращает тег; следующая миграция добавляет
 * свой шаг сюда.
 */
export async function rollbackPlayerPosition(url: string): Promise<string> {
  await rollbackScheduleSlots(url) // 21.2.12: новая миграция откатывается первой
  const tag = await rollbackLastMigration(url)
  if (tag !== '0034_player_position')
    throw new Error(`expected 0034 to roll back first, got ${tag}`)
  return tag
}

/**
 * Откат 0033 (21.2.19) отказывает, пока в кассе есть записи со способом оплаты или категориями
 * «Мячи» / «Судья» / «Тренер»; тесты старых миграций работают на базах без таких записей.
 * Помощник откатывает 0033 и возвращает тег; следующая миграция добавляет свой шаг сюда.
 */
export async function rollbackLedgerMethod(url: string): Promise<string> {
  await rollbackPlayerPosition(url) // 21.2.22: новая миграция откатывается первой
  const tag = await rollbackLastMigration(url)
  if (tag !== '0033_ledger_method_categories')
    throw new Error(`expected 0033 to roll back first, got ${tag}`)
  return tag
}

/**
 * Откат 0032 (21.2.4) отказывает, пока есть сборы. Миграционные тесты старых миграций откатывают
 * свои шаги через этот помощник: он проходит путь оператора из `rollback/0032_collections.sql`
 * (снять связь платежей со сбором, удалить сборы; платежи и касса остаются), откатывает 0032 и
 * возвращает тег. Следующая миграция добавляет свой шаг сюда, а не в каждый тест.
 */
export async function rollbackCollections(url: string): Promise<string> {
  await rollbackLedgerMethod(url) // 21.2.19: новая миграция откатывается первой
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
