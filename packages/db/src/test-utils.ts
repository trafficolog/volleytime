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

/**
 * Возвращает каталог пакетов баланса событий к сиду миграции 0041 (22.2.1): тесты, меняющие каталог,
 * вызывают это в `beforeEach`. Заявки на пакеты и записи аудита каталога очищаются (иначе пакеты не
 * убрать), поэтому вызывать нужно после очистки групп и пользователей. Только для тестов.
 */
export async function resetEventBalancePackages(): Promise<void> {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('resetEventBalancePackages is test-only and forbidden in production')
  }
  await db.execute(sql`DELETE FROM event_balance_purchase_requests`)
  await db.execute(sql`DELETE FROM audit_log WHERE entity_type = 'event_balance_package'`)
  await db.execute(
    sql`DELETE FROM event_balance_packages WHERE code NOT IN ('events_10', 'events_30', 'events_100')`,
  )
  await db.execute(sql`
    UPDATE event_balance_packages p SET
      units = s.units, amount = s.amount, currency = 'BYN', badge = s.badge, visible = true,
      archived_at = NULL, sort_order = s.sort_order, version = 1, updated_at = now()
    FROM (VALUES
      ('events_10', 10, 5000, NULL::text, 10),
      ('events_30', 30, 12000, 'popular', 20),
      ('events_100', 100, 35000, 'discount', 30)
    ) AS s(code, units, amount, badge, sort_order)
    WHERE p.code = s.code`)
}
