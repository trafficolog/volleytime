CREATE TABLE "group_page_complaint_throttle" (
	"day" date PRIMARY KEY NOT NULL,
	"limited" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "group_page_complaints" (
	"id" serial PRIMARY KEY NOT NULL,
	"organization_id" integer NOT NULL,
	"reason_code" varchar(16) NOT NULL,
	"details" varchar(500),
	"reporter_user_id" integer,
	"reporter_hash" char(64) NOT NULL,
	"status" varchar(10) DEFAULT 'new' NOT NULL,
	"resolution" varchar(16),
	"resolved_by_user_id" integer,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "group_page_complaints_reason_chk" CHECK ("group_page_complaints"."reason_code" IN ('price', 'inactive', 'media', 'fraud', 'other')),
	CONSTRAINT "group_page_complaints_status_chk" CHECK ("group_page_complaints"."status" IN ('new', 'rejected', 'resolved')),
	CONSTRAINT "group_page_complaints_resolution_chk" CHECK (("group_page_complaints"."status" = 'new' AND "group_page_complaints"."resolution" IS NULL AND "group_page_complaints"."resolved_at" IS NULL)
        OR ("group_page_complaints"."status" = 'rejected' AND "group_page_complaints"."resolution" = 'no_violation' AND "group_page_complaints"."resolved_at" IS NOT NULL)
        OR ("group_page_complaints"."status" = 'resolved' AND "group_page_complaints"."resolution" IN ('hidden', 'noindex') AND "group_page_complaints"."resolved_at" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "group_page_moderation" (
	"organization_id" integer PRIMARY KEY NOT NULL,
	"state" varchar(8) NOT NULL,
	"reason_code" varchar(16) NOT NULL,
	"note" varchar(1000),
	"actor_user_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "group_page_moderation_state_chk" CHECK ("group_page_moderation"."state" IN ('noindex', 'hidden')),
	CONSTRAINT "group_page_moderation_reason_chk" CHECK ("group_page_moderation"."reason_code" IN ('price', 'pay', 'promise', 'media', 'inactive', 'spam'))
);
--> statement-breakpoint
ALTER TABLE "group_page_complaints" ADD CONSTRAINT "group_page_complaints_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_page_complaints" ADD CONSTRAINT "group_page_complaints_reporter_user_id_users_id_fk" FOREIGN KEY ("reporter_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_page_complaints" ADD CONSTRAINT "group_page_complaints_resolved_by_user_id_users_id_fk" FOREIGN KEY ("resolved_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_page_moderation" ADD CONSTRAINT "group_page_moderation_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_page_moderation" ADD CONSTRAINT "group_page_moderation_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "group_page_complaints_status_created_idx" ON "group_page_complaints" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "group_page_complaints_org_idx" ON "group_page_complaints" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX "group_page_complaints_reporter_created_idx" ON "group_page_complaints" USING btree ("reporter_hash","created_at");