CREATE TYPE "public"."waitlist_offer_status" AS ENUM('offered', 'accepted', 'declined', 'expired', 'revoked');--> statement-breakpoint
CREATE TYPE "public"."scheduled_job_status" AS ENUM('pending', 'running', 'done', 'skipped', 'failed');--> statement-breakpoint
CREATE TABLE "waitlist_offers" (
	"id" serial PRIMARY KEY NOT NULL,
	"organization_id" integer NOT NULL,
	"event_id" integer NOT NULL,
	"booking_id" integer NOT NULL,
	"seats" integer NOT NULL,
	"status" "waitlist_offer_status" DEFAULT 'offered' NOT NULL,
	"offered_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"responded_at" timestamp with time zone,
	CONSTRAINT "waitlist_offers_seats_positive" CHECK ("waitlist_offers"."seats" >= 1),
	CONSTRAINT "waitlist_offers_expires_after_offer" CHECK ("waitlist_offers"."expires_at" > "waitlist_offers"."offered_at")
);
--> statement-breakpoint
CREATE TABLE "scheduled_jobs" (
	"id" serial PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"dedup_key" text NOT NULL,
	"organization_id" integer,
	"event_id" integer,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" "scheduled_job_status" DEFAULT 'pending' NOT NULL,
	"run_at" timestamp with time zone DEFAULT now() NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"locked_until" timestamp with time zone,
	"last_error" text,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "scheduled_jobs_attempts_non_negative" CHECK ("scheduled_jobs"."attempts" >= 0)
);
--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "booking_opens_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "close_before_minutes" smallint DEFAULT 120 NOT NULL;--> statement-breakpoint
ALTER TABLE "waitlist_offers" ADD CONSTRAINT "waitlist_offers_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "waitlist_offers" ADD CONSTRAINT "waitlist_offers_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "waitlist_offers" ADD CONSTRAINT "waitlist_offers_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scheduled_jobs" ADD CONSTRAINT "scheduled_jobs_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scheduled_jobs" ADD CONSTRAINT "scheduled_jobs_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "waitlist_offers_active_booking_uniq" ON "waitlist_offers" USING btree ("booking_id") WHERE "waitlist_offers"."status" = 'offered';--> statement-breakpoint
CREATE INDEX "waitlist_offers_event_status_idx" ON "waitlist_offers" USING btree ("event_id","status");--> statement-breakpoint
CREATE INDEX "waitlist_offers_due_idx" ON "waitlist_offers" USING btree ("expires_at") WHERE "waitlist_offers"."status" = 'offered';--> statement-breakpoint
CREATE UNIQUE INDEX "scheduled_jobs_dedup_uniq" ON "scheduled_jobs" USING btree ("dedup_key");--> statement-breakpoint
CREATE INDEX "scheduled_jobs_due_idx" ON "scheduled_jobs" USING btree ("run_at") WHERE "scheduled_jobs"."status" IN ('pending', 'running');--> statement-breakpoint
CREATE INDEX "scheduled_jobs_event_idx" ON "scheduled_jobs" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "scheduled_jobs_completed_idx" ON "scheduled_jobs" USING btree ("completed_at") WHERE "scheduled_jobs"."status" IN ('done', 'skipped', 'failed');--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_booking_opens_before_start" CHECK ("events"."booking_opens_at" IS NULL OR "events"."booking_opens_at" < "events"."starts_at");--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_close_before_minutes_allowed" CHECK ("events"."close_before_minutes" IN (60, 120, 360, 1440));