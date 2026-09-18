CREATE TYPE "public"."ledger_category" AS ENUM('payment_income', 'rent', 'equipment', 'refund', 'salary', 'other');--> statement-breakpoint
CREATE TYPE "public"."ledger_type" AS ENUM('income', 'expense');--> statement-breakpoint
CREATE TABLE "ledger_entries" (
	"id" serial PRIMARY KEY NOT NULL,
	"organization_id" integer NOT NULL,
	"type" "ledger_type" NOT NULL,
	"category" "ledger_category" NOT NULL,
	"amount" integer NOT NULL,
	"currency" varchar(8) DEFAULT 'BYN' NOT NULL,
	"payment_id" integer,
	"event_id" integer,
	"description" text,
	"created_by_user_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ledger_org_created_idx" ON "ledger_entries" USING btree ("organization_id","created_at");--> statement-breakpoint
CREATE INDEX "ledger_org_type_idx" ON "ledger_entries" USING btree ("organization_id","type");