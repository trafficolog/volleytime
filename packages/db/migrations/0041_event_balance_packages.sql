CREATE TABLE "event_balance_packages" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"units" integer NOT NULL,
	"amount" integer NOT NULL,
	"currency" varchar(8) DEFAULT 'BYN' NOT NULL,
	"badge" text,
	"visible" boolean DEFAULT false NOT NULL,
	"archived_at" timestamp with time zone,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "event_balance_packages_code_unique" UNIQUE("code"),
	CONSTRAINT "event_balance_packages_code_format" CHECK ("event_balance_packages"."code" ~ '^[a-z0-9_]{1,64}$'),
	CONSTRAINT "event_balance_packages_units_positive" CHECK ("event_balance_packages"."units" > 0),
	CONSTRAINT "event_balance_packages_amount_non_negative" CHECK ("event_balance_packages"."amount" >= 0),
	CONSTRAINT "event_balance_packages_badge" CHECK ("event_balance_packages"."badge" IS NULL OR "event_balance_packages"."badge" IN ('popular', 'discount', 'best_price')),
	CONSTRAINT "event_balance_packages_archived_hidden" CHECK ("event_balance_packages"."archived_at" IS NULL OR NOT "event_balance_packages"."visible")
);
--> statement-breakpoint
ALTER TABLE "event_balance_purchase_requests" ADD COLUMN "package_id" integer;--> statement-breakpoint
CREATE UNIQUE INDEX "event_balance_packages_units_currency_active" ON "event_balance_packages" USING btree ("units","currency") WHERE "event_balance_packages"."archived_at" IS NULL;--> statement-breakpoint
ALTER TABLE "event_balance_purchase_requests" ADD CONSTRAINT "event_balance_requests_package_id_fk" FOREIGN KEY ("package_id") REFERENCES "public"."event_balance_packages"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "event_balance_purchase_requests_package_idx" ON "event_balance_purchase_requests" USING btree ("package_id");--> statement-breakpoint
INSERT INTO "event_balance_packages" ("code", "units", "amount", "currency", "badge", "visible", "sort_order") VALUES ('events_10', 10, 5000, 'BYN', NULL, true, 10), ('events_30', 30, 12000, 'BYN', 'popular', true, 20), ('events_100', 100, 35000, 'BYN', 'discount', true, 30) ON CONFLICT ("code") DO NOTHING;--> statement-breakpoint
UPDATE "event_balance_purchase_requests" r SET "package_id" = p."id" FROM "event_balance_packages" p WHERE r."package_id" IS NULL AND r."status" IN ('approved', 'pending') AND p."code" IN ('events_10', 'events_30', 'events_100') AND (p."units", p."amount", p."currency") = (r."units", r."amount", r."currency");
