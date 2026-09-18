CREATE TYPE "public"."member_status_default" AS ENUM('active', 'pending');--> statement-breakpoint
CREATE TYPE "public"."organization_status" AS ENUM('active', 'suspended', 'archived');--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" varchar(64) NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"city" text,
	"sport_type" varchar(32) DEFAULT 'volleyball' NOT NULL,
	"owner_user_id" integer NOT NULL,
	"status" "organization_status" DEFAULT 'active' NOT NULL,
	"default_member_status" "member_status_default" DEFAULT 'active' NOT NULL,
	"default_currency" varchar(8) DEFAULT 'BYN' NOT NULL,
	"default_timezone" varchar(64) DEFAULT 'Europe/Minsk' NOT NULL,
	"public_page_enabled" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "organizations_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "organizations_owner_idx" ON "organizations" USING btree ("owner_user_id");--> statement-breakpoint
CREATE INDEX "organizations_status_idx" ON "organizations" USING btree ("status");