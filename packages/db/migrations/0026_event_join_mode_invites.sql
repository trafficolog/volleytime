CREATE TYPE "public"."invite_request_status" AS ENUM('pending', 'approved', 'declined', 'cancelled');--> statement-breakpoint
CREATE TABLE "event_invite_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"organization_id" integer NOT NULL,
	"event_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"status" "invite_request_status" DEFAULT 'pending' NOT NULL,
	"message" text,
	"decided_by_user_id" integer,
	"decided_at" timestamp with time zone,
	"invite_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "join_mode" "event_join_mode" DEFAULT 'open' NOT NULL;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "invite_id" integer;--> statement-breakpoint
ALTER TABLE "event_invite_requests" ADD CONSTRAINT "event_invite_requests_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_invite_requests" ADD CONSTRAINT "event_invite_requests_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_invite_requests" ADD CONSTRAINT "event_invite_requests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_invite_requests" ADD CONSTRAINT "event_invite_requests_decided_by_user_id_users_id_fk" FOREIGN KEY ("decided_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_invite_requests" ADD CONSTRAINT "event_invite_requests_invite_id_invite_links_id_fk" FOREIGN KEY ("invite_id") REFERENCES "public"."invite_links"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "event_invite_requests_pending_unique" ON "event_invite_requests" USING btree ("event_id","user_id") WHERE "event_invite_requests"."status" = 'pending';--> statement-breakpoint
CREATE INDEX "event_invite_requests_event_status_idx" ON "event_invite_requests" USING btree ("event_id","status");--> statement-breakpoint
CREATE INDEX "event_invite_requests_user_idx" ON "event_invite_requests" USING btree ("user_id");--> statement-breakpoint
ALTER TABLE "invite_links" ADD CONSTRAINT "invite_links_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_invite_id_invite_links_id_fk" FOREIGN KEY ("invite_id") REFERENCES "public"."invite_links"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "invite_links_event_idx" ON "invite_links" USING btree ("event_id");--> statement-breakpoint
ALTER TABLE "invite_links" ADD CONSTRAINT "invite_links_event_join_event" CHECK (("invite_links"."type" = 'event_join') = ("invite_links"."event_id" IS NOT NULL));