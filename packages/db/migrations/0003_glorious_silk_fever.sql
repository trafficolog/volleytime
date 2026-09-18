CREATE TYPE "public"."invite_type" AS ENUM('organization_join', 'event_join', 'subscription_invite', 'staff_invite');--> statement-breakpoint
CREATE TABLE "invite_links" (
	"id" serial PRIMARY KEY NOT NULL,
	"token" varchar(32) NOT NULL,
	"organization_id" integer NOT NULL,
	"event_id" integer,
	"type" "invite_type" DEFAULT 'organization_join' NOT NULL,
	"created_by_user_id" integer NOT NULL,
	"role_to_assign" text DEFAULT 'player' NOT NULL,
	"default_member_status" text DEFAULT 'active' NOT NULL,
	"max_uses" integer,
	"uses_count" integer DEFAULT 0 NOT NULL,
	"expires_at" timestamp with time zone,
	"is_revoked" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "invite_links_token_unique" UNIQUE("token")
);
--> statement-breakpoint
ALTER TABLE "invite_links" ADD CONSTRAINT "invite_links_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invite_links" ADD CONSTRAINT "invite_links_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "invite_links_org_idx" ON "invite_links" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "invite_links_active_idx" ON "invite_links" USING btree ("is_revoked");