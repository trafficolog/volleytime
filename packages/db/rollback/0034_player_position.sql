-- Откат 0034 (21.2.22): снимает амплуа игрока по членству в группе.
-- Откат допустим, только пока нет данных, которые он потерял бы: участников с заданным амплуа.
-- Проверка: `SELECT EXISTS (SELECT 1 FROM organization_members WHERE position IS NOT NULL)` = false.
-- Амплуа задаёт организатор вручную, восстановить его нельзя, поэтому при наличии значений схема
-- остаётся (roll-forward). Очистить амплуа (`UPDATE organization_members SET position = NULL`)
-- можно только по решению владельца и после `pg_dump -t organization_members`.
-- Тип `player_position` создан этой миграцией и удаляется целиком; повторная 0034 создаёт его заново.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "organization_members" WHERE "position" IS NOT NULL) THEN
    RAISE EXCEPTION 'rollback 0034 refused: organization members with a player position exist';
  END IF;
END
$$;
ALTER TABLE "organization_members" DROP COLUMN IF EXISTS "position";
DROP TYPE IF EXISTS "public"."player_position";
