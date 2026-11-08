-- Откат 0037 (21.2.14): удаляет переключатели уведомлений группы.
-- Откат допустим, только пока нет данных, которые он потерял бы: выключенных напоминаний.
-- Проверка: `SELECT EXISTS (SELECT 1 FROM organization_notification_settings WHERE enabled = false)` = false.
-- Прежнее приложение не знает таблицы и шлёт напоминания всем группам: после отката выключенные
-- организатором напоминания начали бы приходить игрокам снова, поэтому при наличии выключенных
-- типов схема остаётся (roll-forward). Включить типы обратно (`UPDATE ... SET enabled = true`) или
-- удалить строки можно только по решению владельца и после `pg_dump -t organization_notification_settings`.
-- Строки с enabled = true совпадают с поведением по умолчанию и теряются без последствий.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "organization_notification_settings" WHERE "enabled" = false) THEN
    RAISE EXCEPTION 'rollback 0037 refused: groups with disabled notification types exist';
  END IF;
END
$$;
DROP TABLE IF EXISTS "organization_notification_settings";
