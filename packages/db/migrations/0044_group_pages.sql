CREATE TABLE "organization_group_pages" (
	"organization_id" integer PRIMARY KEY NOT NULL,
	"sections" jsonb NOT NULL,
	"meta_title" varchar(120),
	"meta_description" varchar(320),
	"updated_by_user_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "organization_group_pages_sections_chk" CHECK (jsonb_typeof("organization_group_pages"."sections") = 'array')
);
--> statement-breakpoint
ALTER TABLE "organization_group_pages" ADD CONSTRAINT "organization_group_pages_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_group_pages" ADD CONSTRAINT "organization_group_pages_updated_by_user_id_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;