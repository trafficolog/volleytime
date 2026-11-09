CREATE TABLE "organization_ownership_transfers" (
	"id" serial PRIMARY KEY NOT NULL,
	"organization_id" integer NOT NULL,
	"from_user_id" integer NOT NULL,
	"to_user_id" integer NOT NULL,
	"token_hash" varchar(64) NOT NULL,
	"status" varchar(16) DEFAULT 'pending' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone,
	CONSTRAINT "org_ownership_transfers_status_chk" CHECK ("organization_ownership_transfers"."status" IN ('pending', 'accepted', 'cancelled', 'expired')),
	CONSTRAINT "org_ownership_transfers_resolved_chk" CHECK (("organization_ownership_transfers"."status" = 'pending') = ("organization_ownership_transfers"."resolved_at" IS NULL)),
	CONSTRAINT "org_ownership_transfers_self_chk" CHECK ("organization_ownership_transfers"."from_user_id" <> "organization_ownership_transfers"."to_user_id"),
	CONSTRAINT "org_ownership_transfers_token_chk" CHECK ("organization_ownership_transfers"."token_hash" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "org_ownership_transfers_expiry_chk" CHECK ("organization_ownership_transfers"."expires_at" > "organization_ownership_transfers"."created_at")
);
--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "restore_until" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "organization_ownership_transfers" ADD CONSTRAINT "organization_ownership_transfers_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_ownership_transfers" ADD CONSTRAINT "organization_ownership_transfers_from_user_id_users_id_fk" FOREIGN KEY ("from_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_ownership_transfers" ADD CONSTRAINT "organization_ownership_transfers_to_user_id_users_id_fk" FOREIGN KEY ("to_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "org_ownership_transfers_token_uniq" ON "organization_ownership_transfers" USING btree ("token_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "org_ownership_transfers_pending_uniq" ON "organization_ownership_transfers" USING btree ("organization_id") WHERE "organization_ownership_transfers"."status" = 'pending';--> statement-breakpoint
CREATE INDEX "org_ownership_transfers_org_idx" ON "organization_ownership_transfers" USING btree ("organization_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "org_members_one_owner_uniq" ON "organization_members" USING btree ("organization_id") WHERE "organization_members"."role" = 'owner';--> statement-breakpoint
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_deleted_restore_chk" CHECK (("organizations"."deleted_at" IS NULL) = ("organizations"."restore_until" IS NULL) AND ("organizations"."restore_until" IS NULL OR "organizations"."restore_until" > "organizations"."deleted_at"));