CREATE TABLE "organization_notification_settings" (
	"organization_id" integer NOT NULL,
	"type" varchar(32) NOT NULL,
	"enabled" boolean NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "organization_notification_settings_organization_id_type_pk" PRIMARY KEY("organization_id","type"),
	CONSTRAINT "org_notification_settings_type_chk" CHECK ("organization_notification_settings"."type" IN ('reminder_24h', 'reminder_2h'))
);
--> statement-breakpoint
ALTER TABLE "organization_notification_settings" ADD CONSTRAINT "organization_notification_settings_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;