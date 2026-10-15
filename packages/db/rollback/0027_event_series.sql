-- Откат 0027 (20.2.2): удаляет серии событий и связь события с датой серии.
-- Даты серии — обычные события: прежний runtime работает с ними без изменений, поэтому откат
-- приложения guard не требует. Откат миграции стёр бы саму серию (правило, исключения, шаблон) и
-- правку «это и последующие»; поэтому он допустим только когда серий нет — проверить
-- `SELECT EXISTS (SELECT 1 FROM event_series)` = false (решение владельца 2026-10-15, D-04).
-- Удалить серии осознанно может только оператор (`DELETE FROM event_series` после выгрузки
-- `pg_dump -t event_series`); события и их записи при этом сохраняются (FK ON DELETE SET NULL).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "event_series") THEN
    RAISE EXCEPTION 'rollback 0027 refused: event_series rows exist';
  END IF;
END
$$;
ALTER TABLE "events" DROP CONSTRAINT IF EXISTS "events_series_date_required";
DROP INDEX IF EXISTS "events_series_date_uniq";
ALTER TABLE "events" DROP CONSTRAINT IF EXISTS "events_series_id_event_series_id_fk";
ALTER TABLE "events" DROP COLUMN IF EXISTS "series_date";
ALTER TABLE "events" DROP COLUMN IF EXISTS "series_id";
DROP TABLE IF EXISTS "event_series";
DROP TYPE IF EXISTS "public"."event_series_status";
