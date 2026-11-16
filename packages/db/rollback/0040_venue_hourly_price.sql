-- Откат 0040 (21.4.13): снимает цену за час зала (venues.hourly_price) и её CHECK.
-- Откат допустим, только пока нет данных, которые он потерял бы: залов с указанной ценой.
-- Проверка: `SELECT EXISTS (SELECT 1 FROM venues WHERE hourly_price IS NOT NULL)` = false.
-- Цену вводит организатор вручную, восстановить её нельзя, поэтому при наличии значений схема
-- остаётся (roll-forward). Прежнее приложение (98b60193, aa8d8f9a) колонку не читает и работает на
-- схеме 0040, откат схемы для отката приложения не нужен (ADR-21-4-13). Очистить цены
-- (`UPDATE venues SET hourly_price = NULL`) можно только по решению владельца и после
-- `pg_dump -t venues`.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "venues" WHERE "hourly_price" IS NOT NULL) THEN
    RAISE EXCEPTION 'rollback 0040 refused: venues with an hourly price exist';
  END IF;
END
$$;
ALTER TABLE "venues" DROP CONSTRAINT IF EXISTS "venues_hourly_price_range";
ALTER TABLE "venues" DROP COLUMN IF EXISTS "hourly_price";
