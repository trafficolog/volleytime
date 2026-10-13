-- Откат 0021: удаляет только то, что добавила миграция (данные R0.7 не затрагиваются).
-- Настройки группы и снимок политики отмены в событиях теряются; enum event_price_mode остаётся (он старше).
ALTER TABLE "organizations" DROP CONSTRAINT IF EXISTS "organizations_cancellation_deadline_non_negative";
ALTER TABLE "organizations" DROP CONSTRAINT IF EXISTS "organizations_max_seats_range";
ALTER TABLE "events" DROP COLUMN IF EXISTS "cancellation_allowed";
ALTER TABLE "organizations" DROP COLUMN IF EXISTS "district";
ALTER TABLE "organizations" DROP COLUMN IF EXISTS "seo_index";
ALTER TABLE "organizations" DROP COLUMN IF EXISTS "cancellation_deadline_hours";
ALTER TABLE "organizations" DROP COLUMN IF EXISTS "cancellation_allowed";
ALTER TABLE "organizations" DROP COLUMN IF EXISTS "default_join_mode";
ALTER TABLE "organizations" DROP COLUMN IF EXISTS "default_price_mode";
ALTER TABLE "organizations" DROP COLUMN IF EXISTS "max_seats_per_booking";
-- event_join_mode создан этой миграцией и больше нигде не используется (events.join_mode добавит 20.1.3)
DROP TYPE IF EXISTS "public"."event_join_mode";
