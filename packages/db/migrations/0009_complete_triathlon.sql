CREATE TYPE "public"."subscription_status" AS ENUM('pending', 'active', 'exhausted', 'expired', 'cancelled');--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" serial PRIMARY KEY NOT NULL,
	"organization_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"plan_id" integer NOT NULL,
	"total_sessions" integer NOT NULL,
	"used_sessions" integer DEFAULT 0 NOT NULL,
	"status" "subscription_status" DEFAULT 'pending' NOT NULL,
	"purchased_at" timestamp with time zone DEFAULT now() NOT NULL,
	"activated_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_plan_id_subscription_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."subscription_plans"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "subscriptions_user_org_idx" ON "subscriptions" USING btree ("user_id","organization_id");--> statement-breakpoint
CREATE INDEX "subscriptions_fifo_idx" ON "subscriptions" USING btree ("user_id","organization_id","status","expires_at");