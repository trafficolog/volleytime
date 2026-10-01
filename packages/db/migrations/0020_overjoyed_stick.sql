CREATE TYPE "public"."event_price_mode" AS ENUM('fixed', 'split');--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "price_mode" "event_price_mode" DEFAULT 'fixed' NOT NULL;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "target_amount" integer;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "pricing_settled_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "pricing_participant_count" integer;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "allocated_amount" integer;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_pricing_mode_consistent" CHECK (("events"."price_mode" = 'fixed' AND "events"."target_amount" IS NULL AND "events"."pricing_settled_at" IS NULL AND "events"."pricing_participant_count" IS NULL) OR ("events"."price_mode" = 'split' AND "events"."price" = 0 AND "events"."target_amount" IS NOT NULL AND "events"."target_amount" > 0));--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_pricing_settlement_pair" CHECK (("events"."pricing_settled_at" IS NULL AND "events"."pricing_participant_count" IS NULL) OR ("events"."pricing_settled_at" IS NOT NULL AND "events"."pricing_participant_count" IS NOT NULL AND "events"."pricing_participant_count" > 0));--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_allocated_amount_positive" CHECK ("bookings"."allocated_amount" IS NULL OR "bookings"."allocated_amount" > 0);