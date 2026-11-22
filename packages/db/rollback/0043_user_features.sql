-- Откат 0043 (23.1.1, P-12): снимает таблицу личных функций игрока.
-- Строка хранит только явный выбор игрока; «включено» — значение по умолчанию и строкой не
-- хранится. Откат допустим, пока ни один игрок ничего не выключал (нет строк enabled = false):
-- иначе выбор игроков пропал бы молча. Строки enabled = true на поведение не влияют.
-- Прежнее приложение таблицу не читает: откат приложения откат схемы не требует.
-- Обход — решение владельца после `pg_dump -t user_features`.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "user_features" WHERE "enabled" = false) THEN
    RAISE EXCEPTION 'rollback 0043 refused: players have switched features off';
  END IF;
END
$$;
DROP TABLE IF EXISTS "user_features";
