CREATE TABLE "platform_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"value" jsonb NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"updated_by" integer,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "platform_settings_key_unique" UNIQUE("key"),
	CONSTRAINT "platform_settings_key_format" CHECK ("platform_settings"."key" ~ '^[a-z][a-zA-Z]*\.[a-z][a-zA-Z]*$'),
	CONSTRAINT "platform_settings_version_positive" CHECK ("platform_settings"."version" >= 1)
);
--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "event_balance_unlimited_until" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "platform_settings" ADD CONSTRAINT "platform_settings_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;