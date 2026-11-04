CREATE TYPE "public"."collection_status" AS ENUM('draft', 'active', 'completed', 'cancelled');--> statement-breakpoint
CREATE TABLE "collections" (
	"id" serial PRIMARY KEY NOT NULL,
	"organization_id" integer NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"icon" varchar(16) DEFAULT 'ball' NOT NULL,
	"target_amount" integer,
	"currency" varchar(8) DEFAULT 'BYN' NOT NULL,
	"status" "collection_status" DEFAULT 'draft' NOT NULL,
	"deadline_at" timestamp with time zone,
	"created_by_user_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"closed_at" timestamp with time zone,
	CONSTRAINT "collections_id_org_uniq" UNIQUE("id","organization_id"),
	CONSTRAINT "collections_target_positive" CHECK ("collections"."target_amount" IS NULL OR "collections"."target_amount" > 0),
	CONSTRAINT "collections_icon_chk" CHECK ("collections"."icon" IN ('ball', 'trophy', 'shirt', 'arena', 'party', 'bus')),
	CONSTRAINT "collections_title_chk" CHECK (char_length(btrim("collections"."title")) BETWEEN 1 AND 120),
	CONSTRAINT "collections_closed_at_chk" CHECK (("collections"."status" IN ('completed', 'cancelled')) = ("collections"."closed_at" IS NOT NULL))
);
--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "collection_id" integer;--> statement-breakpoint
ALTER TABLE "collections" ADD CONSTRAINT "collections_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collections" ADD CONSTRAINT "collections_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "collections_org_created_idx" ON "collections" USING btree ("organization_id","created_at","id");--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_collection_org_fk" FOREIGN KEY ("collection_id","organization_id") REFERENCES "public"."collections"("id","organization_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "payments_collection_idx" ON "payments" USING btree ("collection_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "payments_collection_pending_uniq" ON "payments" USING btree ("collection_id","user_id") WHERE "payments"."collection_id" IS NOT NULL AND "payments"."status" = 'pending';--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_single_target" CHECK (num_nonnulls("payments"."booking_id", "payments"."subscription_id", "payments"."collection_id") <= 1);