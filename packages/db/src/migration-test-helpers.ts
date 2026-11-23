import postgres from 'postgres'

import { rollbackLastMigration } from './rollback'

async function tableApplied(url: string, table: string): Promise<boolean> {
  const sql = postgres(url, { max: 1 })
  try {
    const [row] = await sql<{ applied: boolean }[]>`
      SELECT to_regclass(${`public.${table}`}) IS NOT NULL AS applied`
    return row!.applied
  } finally {
    await sql.end()
  }
}

/**
 * Откат 0046 (24.1.3) отказывает, пока есть решения root или жалобы; тесты старых миграций
 * работают на базах без них. Помощник откатывает 0046 и возвращает тег; следующая миграция
 * добавляет свой шаг сюда.
 */
export async function rollbackGroupPageModeration(url: string): Promise<string> {
  const tag = await rollbackLastMigration(url)
  if (tag !== '0046_group_page_moderation')
    throw new Error(`expected 0046 to roll back first, got ${tag}`)
  return tag
}

/**
 * Откат 0045 (23.1.2) отказывает, пока есть события функций; тесты старых миграций работают на
 * базах без них. Помощник откатывает 0045 и возвращает тег.
 */
export async function rollbackFeatureEvents(url: string): Promise<string> {
  // 24.1.3: новая миграция откатывается первой; повторный вызов после отказа 0045 её уже не найдёт
  if (await tableApplied(url, 'group_page_moderation')) await rollbackGroupPageModeration(url)
  const tag = await rollbackLastMigration(url)
  if (tag !== '0045_feature_events') throw new Error(`expected 0045 to roll back first, got ${tag}`)
  return tag
}

/**
 * Откат 0044 (24.1.1) отказывает, пока у групп есть сохранённые страницы; тесты старых миграций
 * работают на базах без них. Помощник откатывает 0044 и возвращает тег.
 */
export async function rollbackGroupPages(url: string): Promise<string> {
  // 23.1.2: новая миграция откатывается первой; повторный вызов после отказа 0044 её уже не найдёт
  if (await tableApplied(url, 'feature_events')) await rollbackFeatureEvents(url)
  const tag = await rollbackLastMigration(url)
  if (tag !== '0044_group_pages') throw new Error(`expected 0044 to roll back first, got ${tag}`)
  return tag
}

/**
 * Откат 0043 (23.1.1) отказывает, пока игроки выключали функции; тесты старых миграций работают на
 * базах без таких выборов. Помощник откатывает 0043 и возвращает тег; следующая миграция добавляет
 * свой шаг сюда.
 */
export async function rollbackUserFeatures(url: string): Promise<string> {
  // 24.1.1: новая миграция откатывается первой; повторный вызов после отказа 0043 её уже не найдёт
  if (await tableApplied(url, 'organization_group_pages')) await rollbackGroupPages(url)
  const tag = await rollbackLastMigration(url)
  if (tag !== '0043_user_features') throw new Error(`expected 0043 to roll back first, got ${tag}`)
  return tag
}

/**
 * Откат 0042 (22.3.1) отказывает, пока есть строки platform_settings или заданные даты безлимита
 * событий; тесты старых миграций работают на базах без них. Помощник откатывает 0042 и возвращает
 * тег; следующая миграция добавляет свой шаг сюда.
 */
export async function rollbackPlatformSettings(url: string): Promise<string> {
  // 23.1.1: новая миграция откатывается первой; повторный вызов после отказа 0042 её уже не найдёт
  const sql = postgres(url, { max: 1 })
  let userFeaturesApplied: boolean
  try {
    const [row] = await sql<{ applied: boolean }[]>`
      SELECT to_regclass('public.user_features') IS NOT NULL AS applied`
    userFeaturesApplied = row!.applied
  } finally {
    await sql.end()
  }
  if (userFeaturesApplied) await rollbackUserFeatures(url)
  const tag = await rollbackLastMigration(url)
  if (tag !== '0042_platform_settings')
    throw new Error(`expected 0042 to roll back first, got ${tag}`)
  return tag
}

/**
 * Откат 0041 (22.2.1) отказывает, пока каталог пакетов отличается от сида или есть связи заявок,
 * созданные после миграции; тесты старых миграций работают на чистом сиде. Помощник откатывает 0041
 * и возвращает тег; следующая миграция добавляет свой шаг сюда.
 */
export async function rollbackEventBalancePackages(url: string): Promise<string> {
  // 22.3.1: новая миграция откатывается первой; повторный вызов после отказа 0041 её уже не найдёт
  const sql = postgres(url, { max: 1 })
  let platformSettingsApplied: boolean
  try {
    const [row] = await sql<{ applied: boolean }[]>`
      SELECT to_regclass('public.platform_settings') IS NOT NULL AS applied`
    platformSettingsApplied = row!.applied
  } finally {
    await sql.end()
  }
  if (platformSettingsApplied) await rollbackPlatformSettings(url)
  const tag = await rollbackLastMigration(url)
  if (tag !== '0041_event_balance_packages')
    throw new Error(`expected 0041 to roll back first, got ${tag}`)
  return tag
}

/**
 * Откат 0040 (21.4.13) отказывает, пока у залов указана цена за час; тесты старых миграций
 * работают на базах без цены. Помощник откатывает 0040 и возвращает тег; следующая миграция
 * добавляет свой шаг сюда.
 */
export async function rollbackVenueHourlyPrice(url: string): Promise<string> {
  await rollbackEventBalancePackages(url) // 22.2.1: новая миграция откатывается первой
  const tag = await rollbackLastMigration(url)
  if (tag !== '0040_venue_hourly_price')
    throw new Error(`expected 0040 to roll back first, got ${tag}`)
  return tag
}

/**
 * Откат 0039 (21.2.17) отказывает, пока есть удалённые группы или ожидающие передачи владения;
 * тесты старых миграций работают на базах без них. Помощник откатывает 0039 и возвращает тег;
 * следующая миграция добавляет свой шаг сюда.
 */
export async function rollbackGroupOwnership(url: string): Promise<string> {
  await rollbackVenueHourlyPrice(url) // 21.4.13: новая миграция откатывается первой
  const tag = await rollbackLastMigration(url)
  if (tag !== '0039_group_ownership_soft_delete')
    throw new Error(`expected 0039 to roll back first, got ${tag}`)
  return tag
}

/**
 * Откат 0038 (21.2.16) отказывает, пока есть логотип или короткая ссылка группы; тесты старых
 * миграций работают на базах без них. Помощник откатывает 0038 и возвращает тег; следующая
 * миграция добавляет свой шаг сюда.
 */
export async function rollbackLogoShortLink(url: string): Promise<string> {
  await rollbackGroupOwnership(url) // 21.2.17: новая миграция откатывается первой
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
