-- Откат 0045 (23.1.2, P-14, D-25): снимает таблицу событий функций игрока.
-- События — единственный источник метрик активности и удержания функций за 180 дней; откат
-- допустим, только пока ни одного события нет: иначе история пропала бы молча.
-- Прежнее приложение таблицу не читает: откат приложения откат схемы не требует.
-- Обход — решение владельца после `pg_dump -t feature_events`.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "feature_events") THEN
    RAISE EXCEPTION 'rollback 0045 refused: feature events are recorded';
  END IF;
END
$$;
DROP TABLE IF EXISTS "feature_events";
