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
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_cancellation_deadline_non_negative" CHECK ("organizations"."cancellation_deadline_hours" IS NULL OR "organizations"."cancellation_deadline_hours" >= 0);