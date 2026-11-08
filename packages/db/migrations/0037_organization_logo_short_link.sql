CREATE TABLE "organization_logos" (
	"organization_id" integer PRIMARY KEY NOT NULL,
	"data" "bytea" NOT NULL,
	"mime_type" varchar(16) NOT NULL,
	"size_bytes" integer NOT NULL,
	"updated_by_user_id" integer,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "organization_logos_mime_chk" CHECK ("organization_logos"."mime_type" IN ('image/png', 'image/jpeg')),
	CONSTRAINT "organization_logos_size_chk" CHECK ("organization_logos"."size_bytes" BETWEEN 1 AND 524288),
	CONSTRAINT "organization_logos_data_size_chk" CHECK (octet_length("organization_logos"."data") = "organization_logos"."size_bytes")
);
--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "short_link" varchar(32);--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "logo_updated_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "organization_logos" ADD CONSTRAINT "organization_logos_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_logos" ADD CONSTRAINT "organization_logos_updated_by_user_id_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "organizations_short_link_uniq" ON "organizations" USING btree ("short_link");--> statement-breakpoint
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_short_link_format" CHECK ("organizations"."short_link" IS NULL OR ("organizations"."short_link" ~ '^[a-z0-9][a-z0-9-]{1,30}[a-z0-9]$' AND "organizations"."short_link" !~ '--'));