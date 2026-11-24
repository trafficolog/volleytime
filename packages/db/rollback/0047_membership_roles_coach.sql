-- Откат 0047 (30.1.1, P-18, D-31): тренеры возвращаются в помощников, флаг приёма оплаты и тренеры
-- событий удаляются. Значения `coach` и `assistant` остаются в enum `member_role` (правило 6 ADR v3:
-- значения enum не удаляются); прежний runtime `coach` не пишет.
-- Флаг приёма оплаты и назначенные тренеры — решения владельца и организатора, которые прежний
-- runtime не умеет хранить: откат молча снял бы их. Поэтому откат допустим, только пока нет ни
-- выданных флагов, ни событий с тренерами. Обход — решение владельца после
-- `pg_dump -t organization_members -t events`.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "organization_members" WHERE "can_accept_payment") THEN
    RAISE EXCEPTION 'rollback 0047 refused: coaches accept payments';
  END IF;
  IF EXISTS (SELECT 1 FROM "events" WHERE cardinality("coach_user_ids") > 0) THEN
    RAISE EXCEPTION 'rollback 0047 refused: events have assigned coaches';
  END IF;
END
$$;
UPDATE "organization_members" SET "role" = 'assistant' WHERE "role" = 'coach';
UPDATE "invite_links" SET "role_to_assign" = 'assistant' WHERE "role_to_assign" = 'coach';
ALTER TABLE "events" DROP COLUMN IF EXISTS "coach_user_ids";
ALTER TABLE "organization_members" DROP COLUMN IF EXISTS "can_accept_payment";
