CREATE TYPE "public"."event_balance_actor" AS ENUM('user', 'system');--> statement-breakpoint
CREATE TYPE "public"."event_balance_reason" AS ENUM('demo_grant', 'pilot_grant', 'purchase', 'grant', 'spend', 'refund', 'correction');--> statement-breakpoint
CREATE TYPE "public"."purchase_request_status" AS ENUM('pending', 'approved', 'rejected', 'cancelled');--> statement-breakpoint
CREATE TABLE "event_balance_entries" (
	"id" serial PRIMARY KEY NOT NULL,
	"organization_id" integer NOT NULL,
	"delta" integer NOT NULL,
	"reason" "event_balance_reason" NOT NULL,
	"balance_after" integer NOT NULL,
	"event_id" integer,
	"purchase_request_id" integer,
	"actor_kind" "event_balance_actor" NOT NULL,
	"created_by_user_id" integer,
	"source" text,
	"comment" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "event_balance_entries_delta_non_zero" CHECK ("event_balance_entries"."delta" <> 0),
	CONSTRAINT "event_balance_entries_balance_after_non_negative" CHECK ("event_balance_entries"."balance_after" >= 0),
	CONSTRAINT "event_balance_entries_delta_sign" CHECK (("event_balance_entries"."reason" = 'spend' AND "event_balance_entries"."delta" < 0) OR "event_balance_entries"."reason" = 'correction' OR ("event_balance_entries"."reason" NOT IN ('spend', 'correction') AND "event_balance_entries"."delta" > 0)),
	CONSTRAINT "event_balance_entries_actor_user" CHECK (("event_balance_entries"."actor_kind" = 'user') = ("event_balance_entries"."created_by_user_id" IS NOT NULL)),
	CONSTRAINT "event_balance_entries_system_source" CHECK ("event_balance_entries"."actor_kind" <> 'system' OR "event_balance_entries"."source" IS NOT NULL),
	CONSTRAINT "event_balance_entries_comment_required" CHECK (("event_balance_entries"."actor_kind" <> 'system' AND "event_balance_entries"."reason" NOT IN ('grant', 'correction')) OR "event_balance_entries"."comment" IS NOT NULL),
	CONSTRAINT "event_balance_entries_purchase_request" CHECK (("event_balance_entries"."reason" = 'purchase') = ("event_balance_entries"."purchase_request_id" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "event_balance_purchase_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"organization_id" integer NOT NULL,
	"requested_by_user_id" integer NOT NULL,
	"units" integer NOT NULL,
	"amount" integer NOT NULL,
	"currency" varchar(8) NOT NULL,
	"status" "purchase_request_status" DEFAULT 'pending' NOT NULL,
	"decided_by_user_id" integer,
	"decided_at" timestamp with time zone,
	"decision_comment" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "event_balance_purchase_requests_units_positive" CHECK ("event_balance_purchase_requests"."units" > 0),
	CONSTRAINT "event_balance_purchase_requests_amount_non_negative" CHECK ("event_balance_purchase_requests"."amount" >= 0),
	CONSTRAINT "event_balance_purchase_requests_decision" CHECK (("event_balance_purchase_requests"."status" = 'pending') = ("event_balance_purchase_requests"."decided_at" IS NULL))
);
--> statement-breakpoint
CREATE TABLE "organization_event_balances" (
	"organization_id" integer PRIMARY KEY NOT NULL,
	"balance" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "organization_event_balances_non_negative" CHECK ("organization_event_balances"."balance" >= 0)
);
--> statement-breakpoint
ALTER TABLE "event_balance_entries" ADD CONSTRAINT "event_balance_entries_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_balance_entries" ADD CONSTRAINT "event_balance_entries_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_balance_entries" ADD CONSTRAINT "event_balance_entries_purchase_request_id_event_balance_purchase_requests_id_fk" FOREIGN KEY ("purchase_request_id") REFERENCES "public"."event_balance_purchase_requests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_balance_entries" ADD CONSTRAINT "event_balance_entries_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_balance_purchase_requests" ADD CONSTRAINT "event_balance_purchase_requests_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_balance_purchase_requests" ADD CONSTRAINT "event_balance_purchase_requests_requested_by_user_id_users_id_fk" FOREIGN KEY ("requested_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_balance_purchase_requests" ADD CONSTRAINT "event_balance_purchase_requests_decided_by_user_id_users_id_fk" FOREIGN KEY ("decided_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_event_balances" ADD CONSTRAINT "organization_event_balances_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "event_balance_entries_org_created_idx" ON "event_balance_entries" USING btree ("organization_id","created_at","id");--> statement-breakpoint
CREATE INDEX "event_balance_entries_event_idx" ON "event_balance_entries" USING btree ("event_id");--> statement-breakpoint
CREATE UNIQUE INDEX "event_balance_spend_event_uniq" ON "event_balance_entries" USING btree ("event_id") WHERE "event_balance_entries"."reason" = 'spend';--> statement-breakpoint
CREATE UNIQUE INDEX "event_balance_refund_event_uniq" ON "event_balance_entries" USING btree ("event_id") WHERE "event_balance_entries"."reason" = 'refund';--> statement-breakpoint
CREATE UNIQUE INDEX "event_balance_demo_grant_org_uniq" ON "event_balance_entries" USING btree ("organization_id") WHERE "event_balance_entries"."reason" = 'demo_grant';--> statement-breakpoint
CREATE UNIQUE INDEX "event_balance_pilot_grant_org_uniq" ON "event_balance_entries" USING btree ("organization_id") WHERE "event_balance_entries"."reason" = 'pilot_grant';--> statement-breakpoint
CREATE UNIQUE INDEX "event_balance_purchase_request_uniq" ON "event_balance_entries" USING btree ("purchase_request_id") WHERE "event_balance_entries"."reason" = 'purchase';--> statement-breakpoint
CREATE INDEX "event_balance_purchase_requests_org_idx" ON "event_balance_purchase_requests" USING btree ("organization_id","created_at");--> statement-breakpoint
-- backfill (D-12): каждая организация, существующая на момент миграции, — пилотная: стартовый баланс 48
-- событий отдельной системной операцией pilot_grant (без demo_grant), прошлые события не списываются.
-- Идемпотентно (WHERE NOT EXISTS, без ON CONFLICT на денежной строке): журнал и проекция пишутся только
-- организациям без единой строки баланса, поэтому balance_after = 48 и проекция = сумма журнала.
INSERT INTO "event_balance_entries" ("organization_id", "delta", "reason", "balance_after", "actor_kind", "source", "comment")
SELECT o."id", 48, 'pilot_grant', 48, 'system', 'pilot_grant', 'Стартовый баланс пилотной группы: 48 событий (решение D-12, миграция 0024)'
FROM "organizations" o
WHERE NOT EXISTS (SELECT 1 FROM "event_balance_entries" e WHERE e."organization_id" = o."id")
  AND NOT EXISTS (SELECT 1 FROM "organization_event_balances" b WHERE b."organization_id" = o."id");--> statement-breakpoint
INSERT INTO "organization_event_balances" ("organization_id", "balance")
SELECT e."organization_id", e."balance_after" FROM "event_balance_entries" e
WHERE e."reason" = 'pilot_grant'
  AND NOT EXISTS (SELECT 1 FROM "organization_event_balances" b WHERE b."organization_id" = e."organization_id");
