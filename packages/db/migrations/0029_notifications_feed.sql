CREATE TYPE "public"."notification_delivery_status" AS ENUM('pending', 'sent', 'failed', 'skipped');--> statement-breakpoint
CREATE TYPE "public"."notification_type" AS ENUM('booking_opened', 'waitlist_offer', 'waitlist_offer_expired', 'reminder_24h', 'reminder_2h', 'split_settled', 'payment_confirmed', 'payment_rejected', 'lineup_ready', 'mvp_vote', 'event_cancelled', 'organizer_action_required');--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"recipient_user_id" integer NOT NULL,
	"organization_id" integer,
	"event_id" integer,
	"type" "notification_type" NOT NULL,
	"dedup_key" text NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"read_at" timestamp with time zone,
	"delivery_status" "notification_delivery_status" DEFAULT 'pending' NOT NULL,
	"delivered_at" timestamp with time zone,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "quiet_hours_start" smallint;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "quiet_hours_end" smallint;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "bot_blocked_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_recipient_user_id_users_id_fk" FOREIGN KEY ("recipient_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "notifications_recipient_dedup_uniq" ON "notifications" USING btree ("recipient_user_id","dedup_key");--> statement-breakpoint
CREATE INDEX "notifications_feed_idx" ON "notifications" USING btree ("recipient_user_id","id" DESC);--> statement-breakpoint
CREATE INDEX "notifications_organization_idx" ON "notifications" USING btree ("organization_id");--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_quiet_hours_range" CHECK (("users"."quiet_hours_start" IS NULL OR "users"."quiet_hours_start" BETWEEN 0 AND 1439)
      AND ("users"."quiet_hours_end" IS NULL OR "users"."quiet_hours_end" BETWEEN 0 AND 1439)
      AND (("users"."quiet_hours_start" IS NULL) = ("users"."quiet_hours_end" IS NULL)));