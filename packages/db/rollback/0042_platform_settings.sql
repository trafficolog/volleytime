-- Откат 0042 (22.3.1, ADR-22-3-1, D-20): снимает настройки платформы и безлимит событий группы.
-- Откат допустим, только пока нет значений, введённых root вручную: ни одной строки
-- platform_settings и ни одной заданной даты безлимита (event_balance_unlimited_until IS NOT NULL,
-- даже истёкшей — решение владельца). История изменений есть в audit_log, но восстанавливать
-- значения руками — решение владельца.
-- Прежнее приложение таблицу и колонку не читает: откат приложения откат схемы не требует.
-- Обход — решение владельца после `pg_dump -t platform_settings` и выборки колонки
-- `SELECT id, event_balance_unlimited_until FROM organizations WHERE event_balance_unlimited_until IS NOT NULL`.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "platform_settings") THEN
    RAISE EXCEPTION 'rollback 0042 refused: platform_settings has rows';
  END IF;
  IF EXISTS (SELECT 1 FROM "organizations" WHERE "event_balance_unlimited_until" IS NOT NULL) THEN
    RAISE EXCEPTION 'rollback 0042 refused: organizations with an event balance unlimited date exist';
  END IF;
END
$$;
ALTER TABLE "organizations" DROP COLUMN IF EXISTS "event_balance_unlimited_until";
DROP TABLE IF EXISTS "platform_settings";
