-- Откат 0023: удаляет только то, что добавила миграция. Уровни игроков, групп и событий теряются;
-- organization_members.rating_in_org не затрагивается (остаётся до contract-шага не раньше v0.3.0).
ALTER TABLE "events" DROP CONSTRAINT IF EXISTS "events_level_player_levels_code_fk";
ALTER TABLE "organization_members" DROP CONSTRAINT IF EXISTS "organization_members_level_player_levels_code_fk";
ALTER TABLE "events" DROP COLUMN IF EXISTS "level";
ALTER TABLE "organization_members" DROP COLUMN IF EXISTS "level";
ALTER TABLE "organizations" DROP COLUMN IF EXISTS "levels";
DROP TABLE IF EXISTS "player_levels";
DROP TYPE IF EXISTS "public"."player_level";
