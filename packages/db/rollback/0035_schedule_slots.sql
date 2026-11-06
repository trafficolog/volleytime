-- Откат 0035 (21.2.12): удаляет шаблоны слотов расписания групп.
-- Откат допустим, только пока нет данных, которые он потерял бы: слотов, заведённых организаторами.
-- Проверка: `SELECT EXISTS (SELECT 1 FROM schedule_slots)` = false.
-- Слоты вносятся вручную и не восстанавливаются, поэтому при их наличии схема остаётся (roll-forward).
-- Удалить слоты (`DELETE FROM schedule_slots`) можно только по решению владельца и после
-- `pg_dump -t schedule_slots`. Таблицу не читают события, серии и баланс: откат не затрагивает их.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "schedule_slots") THEN
    RAISE EXCEPTION 'rollback 0035 refused: schedule slots exist';
  END IF;
END
$$;
DROP TABLE IF EXISTS "schedule_slots";
