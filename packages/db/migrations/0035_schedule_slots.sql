CREATE TABLE "schedule_slots" (
	"id" serial PRIMARY KEY NOT NULL,
	"organization_id" integer NOT NULL,
	"weekday" smallint NOT NULL,
	"start_time" varchar(5) NOT NULL,
	"duration_minutes" integer DEFAULT 120 NOT NULL,
	"title" text NOT NULL,
	"type" "event_type" DEFAULT 'training' NOT NULL,
	"venue_id" integer,
	"capacity" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "schedule_slots_weekday_chk" CHECK ("schedule_slots"."weekday" BETWEEN 1 AND 7),
	CONSTRAINT "schedule_slots_start_time_chk" CHECK ("schedule_slots"."start_time" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
	CONSTRAINT "schedule_slots_duration_chk" CHECK ("schedule_slots"."duration_minutes" BETWEEN 15 AND 1440),
	CONSTRAINT "schedule_slots_capacity_chk" CHECK ("schedule_slots"."capacity" BETWEEN 1 AND 500),
	CONSTRAINT "schedule_slots_title_chk" CHECK (char_length(btrim("schedule_slots"."title")) BETWEEN 2 AND 200),
	CONSTRAINT "schedule_slots_type_chk" CHECK ("schedule_slots"."type" <> 'tournament_match')
);
--> statement-breakpoint
ALTER TABLE "schedule_slots" ADD CONSTRAINT "schedule_slots_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schedule_slots" ADD CONSTRAINT "schedule_slots_venue_id_venues_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "schedule_slots_org_idx" ON "schedule_slots" USING btree ("organization_id","weekday","start_time");