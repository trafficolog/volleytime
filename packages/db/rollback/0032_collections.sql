-- Откат 0032 (21.2.4): удаляет сборы и связь платежа со сбором.
-- Взнос — платёж с `collection_id`: откат стёр бы, в какой сбор внесены деньги (суммы сборов,
-- участники, обещания), а записи кассы `contribution` остались бы без сбора. Поэтому откат допустим,
-- только когда сборов нет — проверить `SELECT EXISTS (SELECT 1 FROM collections)` = false.
-- Удалить сборы осознанно может только оператор: выгрузить `pg_dump -t collections -t payments`,
-- снять связь `UPDATE payments SET collection_id = NULL WHERE collection_id IS NOT NULL` (платежи и
-- касса остаются, как платежи без цели) и `DELETE FROM collections` — в одной транзакции с откатом.
-- Данные R0.7 откат не трогает; значение enum не используется прежним runtime.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "collections") THEN
    RAISE EXCEPTION 'rollback 0032 refused: collections rows exist';
  END IF;
END
$$;
ALTER TABLE "payments" DROP CONSTRAINT IF EXISTS "payments_single_target";
DROP INDEX IF EXISTS "payments_collection_pending_uniq";
DROP INDEX IF EXISTS "payments_collection_idx";
ALTER TABLE "payments" DROP CONSTRAINT IF EXISTS "payments_collection_org_fk";
ALTER TABLE "payments" DROP COLUMN IF EXISTS "collection_id";
DROP TABLE IF EXISTS "collections";
DROP TYPE IF EXISTS "public"."collection_status";
