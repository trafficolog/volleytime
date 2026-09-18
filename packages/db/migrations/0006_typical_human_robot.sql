CREATE TYPE "public"."event_status" AS ENUM('draft', 'published', 'closed', 'finished', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."event_type" AS ENUM('training', 'open_game', 'tournament_match', 'custom');--> statement-breakpoint
CREATE TABLE "events" (
	"id" serial PRIMARY KEY NOT NULL,
	"organization_id" integer NOT NULL,
	"venue_id" integer,
	"created_by_user_id" integer NOT NULL,
	"type" "event_type" DEFAULT 'training' NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"location_text" text,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"capacity" integer NOT NULL,
	"price" integer DEFAULT 0 NOT NULL,
	"currency" varchar(8) DEFAULT 'BYN' NOT NULL,
	"cancellation_deadline_hours" integer,
	"status" "event_status" DEFAULT 'published' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_venue_id_venues_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "events_org_starts_idx" ON "events" USING btree ("organization_id","starts_at");--> statement-breakpoint
CREATE INDEX "events_status_idx" ON "events" USING btree ("status");--> statement-breakpoint
CREATE INDEX "events_venue_idx" ON "events" USING btree ("venue_id");