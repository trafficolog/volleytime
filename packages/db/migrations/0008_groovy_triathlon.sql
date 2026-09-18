CREATE TYPE "public"."plan_status" AS ENUM('active', 'archived');--> statement-breakpoint
CREATE TABLE "subscription_plans" (
	"id" serial PRIMARY KEY NOT NULL,
	"organization_id" integer NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"total_sessions" integer NOT NULL,
	"validity_days" integer,
	"price" integer DEFAULT 0 NOT NULL,
	"currency" varchar(8) DEFAULT 'BYN' NOT NULL,
	"status" "plan_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "subscription_plans" ADD CONSTRAINT "subscription_plans_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "subscription_plans_org_idx" ON "subscription_plans" USING btree ("organization_id");