CREATE TYPE "public"."event_join_mode" AS ENUM('open', 'invite');--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "max_seats_per_booking" smallint DEFAULT 3 NOT NULL;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "default_price_mode" "event_price_mode" DEFAULT 'fixed' NOT NULL;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "default_join_mode" "event_join_mode" DEFAULT 'open' NOT NULL;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "cancellation_allowed" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "cancellation_deadline_hours" integer;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "seo_index" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "district" text;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "cancellation_allowed" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_max_seats_range" CHECK ("organizations"."max_seats_per_booking" >= 1 AND "organizations"."max_seats_per_booking" <= 10);--> statement-breakpoint
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_cancellation_deadline_non_negative" CHECK ("organizations"."cancellation_deadline_hours" IS NULL OR "organizations"."cancellation_deadline_hours" >= 0);--> statement-breakpoint
-- Backfill (R0.7): срок отмены раньше задавался у события (форма по умолчанию — 6 ч). Группа получает самый частый
-- срок своих событий, без событий со сроком — 6, чтобы новые события не стали «отмена до начала».
UPDATE "organizations" o SET "cancellation_deadline_hours" = COALESCE((
  SELECT e."cancellation_deadline_hours" FROM "events" e
  WHERE e."organization_id" = o."id" AND e."cancellation_deadline_hours" IS NOT NULL
  GROUP BY e."cancellation_deadline_hours"
  ORDER BY count(*) DESC, e."cancellation_deadline_hours" DESC LIMIT 1
), 6);
