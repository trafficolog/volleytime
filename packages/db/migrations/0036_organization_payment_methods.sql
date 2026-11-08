CREATE TABLE "organization_payment_methods" (
	"id" serial PRIMARY KEY NOT NULL,
	"organization_id" integer NOT NULL,
	"method" varchar(16) NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"bank" varchar(100),
	"card_last4" varchar(4),
	"recipient" varchar(100),
	"updated_by_user_id" integer,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "org_payment_methods_method_chk" CHECK ("organization_payment_methods"."method" IN ('cash', 'transfer')),
	CONSTRAINT "org_payment_methods_card_last4_chk" CHECK ("organization_payment_methods"."card_last4" IS NULL OR "organization_payment_methods"."card_last4" ~ '^[0-9]{4}$'),
	CONSTRAINT "org_payment_methods_details_chk" CHECK ("organization_payment_methods"."method" = 'transfer' OR ("organization_payment_methods"."bank" IS NULL AND "organization_payment_methods"."card_last4" IS NULL AND "organization_payment_methods"."recipient" IS NULL))
);
--> statement-breakpoint
ALTER TABLE "organization_payment_methods" ADD CONSTRAINT "organization_payment_methods_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_payment_methods" ADD CONSTRAINT "organization_payment_methods_updated_by_user_id_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "org_payment_methods_org_method_uniq" ON "organization_payment_methods" USING btree ("organization_id","method");