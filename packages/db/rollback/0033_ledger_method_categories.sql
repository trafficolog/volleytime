-- Откат 0033 (21.2.19): снимает способ оплаты ручной записи кассы.
-- Откат допустим, только пока нет данных, которые он потерял бы: записей с заполненным способом
-- оплаты и записей с категориями «Мячи» / «Судья» / «Тренер» (`balls`, `referee`, `coach`).
-- Проверка: `SELECT EXISTS (SELECT 1 FROM ledger_entries WHERE method IS NOT NULL OR category IN
-- ('balls', 'referee', 'coach'))` = false. Касса append-only: такие записи не удаляются, поэтому
-- при их наличии схема остаётся (roll-forward). Очистить способ оплаты (`UPDATE ledger_entries SET
-- method = NULL`) можно только по решению владельца и после `pg_dump -t ledger_entries`.
-- Значения enum PostgreSQL не удаляются (как в 0017 и 0018): `balls`, `referee`, `coach` остаются
-- в типе неиспользуемыми; повторная миграция 0033 добавляет их через `IF NOT EXISTS`.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "ledger_entries"
    WHERE "method" IS NOT NULL OR "category" IN ('balls', 'referee', 'coach')
  ) THEN
    RAISE EXCEPTION 'rollback 0033 refused: ledger entries with a payment method or new category exist';
  END IF;
END
$$;
ALTER TABLE "ledger_entries" DROP CONSTRAINT IF EXISTS "ledger_entries_method_chk";
ALTER TABLE "ledger_entries" DROP COLUMN IF EXISTS "method";
