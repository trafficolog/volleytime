CREATE TYPE "public"."event_series_status" AS ENUM('active', 'ended');--> statement-breakpoint
CREATE TABLE "event_series" (
	"id" serial PRIMARY KEY NOT NULL,
	"organization_id" integer NOT NULL,
	"created_by_user_id" integer NOT NULL,
	"rule" jsonb NOT NULL,
	"exceptions" date[] DEFAULT '{}'::date[] NOT NULL,
	"template" jsonb NOT NULL,
	"timezone" varchar(64) NOT NULL,
	"status" "event_series_status" DEFAULT 'active' NOT NULL,
	"idempotency_key" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "series_id" integer;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "series_date" date;--> statement-breakpoint
ALTER TABLE "event_series" ADD CONSTRAINT "event_series_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_series" ADD CONSTRAINT "event_series_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "event_series_org_idx" ON "event_series" USING btree ("organization_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "event_series_idempotency_uniq" ON "event_series" USING btree ("organization_id","idempotency_key") WHERE "event_series"."idempotency_key" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_series_id_event_series_id_fk" FOREIGN KEY ("series_id") REFERENCES "public"."event_series"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "events_series_date_uniq" ON "events" USING btree ("series_id","series_date");--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_series_date_required" CHECK ("events"."series_id" IS NULL OR "events"."series_date" IS NOT NULL);