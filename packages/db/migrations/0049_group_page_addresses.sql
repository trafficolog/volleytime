CREATE TABLE "group_page_addresses" (
	"city_slug" varchar(64) NOT NULL,
	"group_slug" varchar(64) NOT NULL,
	"organization_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "group_page_addresses_city_slug_group_slug_pk" PRIMARY KEY("city_slug","group_slug"),
	CONSTRAINT "group_page_addresses_city_slug_chk" CHECK ("group_page_addresses"."city_slug" ~ '^([a-z0-9-]{1,64})?$'),
	CONSTRAINT "group_page_addresses_group_slug_chk" CHECK ("group_page_addresses"."group_slug" ~ '^[a-z0-9][a-z0-9-]{0,63}$')
);
--> statement-breakpoint
ALTER TABLE "group_page_addresses" ADD CONSTRAINT "group_page_addresses_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "group_page_addresses_group_slug_idx" ON "group_page_addresses" USING btree ("group_slug");--> statement-breakpoint
CREATE INDEX "group_page_addresses_org_idx" ON "group_page_addresses" USING btree ("organization_id");