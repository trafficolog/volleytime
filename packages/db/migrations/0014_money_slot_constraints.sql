-- 5.13.13: чистка нарушений перед ограничениями (данные v0.1.0)
UPDATE "bookings" SET "subscription_id" = NULL WHERE "subscription_id" IS NOT NULL AND "subscription_id" NOT IN (SELECT "id" FROM "subscriptions");--> statement-breakpoint
UPDATE "bookings" SET "payment_id" = NULL WHERE "payment_id" IS NOT NULL AND "payment_id" NOT IN (SELECT "id" FROM "payments");--> statement-breakpoint
UPDATE "subscriptions" SET "used_sessions" = LEAST(GREATEST("used_sessions", 0), "total_sessions");--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_subscription_id_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."subscriptions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_capacity_positive" CHECK ("events"."capacity" > 0);--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_price_non_negative" CHECK ("events"."price" >= 0);--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_ends_after_start" CHECK ("events"."ends_at" > "events"."starts_at");--> statement-breakpoint
ALTER TABLE "subscription_plans" ADD CONSTRAINT "subscription_plans_sessions_positive" CHECK ("subscription_plans"."total_sessions" > 0);--> statement-breakpoint
ALTER TABLE "subscription_plans" ADD CONSTRAINT "subscription_plans_price_non_negative" CHECK ("subscription_plans"."price" >= 0);--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_used_within_total" CHECK ("subscriptions"."used_sessions" >= 0 AND "subscriptions"."used_sessions" <= "subscriptions"."total_sessions");--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_total_positive" CHECK ("subscriptions"."total_sessions" > 0);--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_amount_positive" CHECK ("payments"."amount" > 0);--> statement-breakpoint
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_amount_positive" CHECK ("ledger_entries"."amount" > 0);;--> statement-breakpoint
-- bookings.payment_id → payments: объявлен SQL (цикл импортов bookings↔payments в Drizzle-схеме)
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE set null ON UPDATE no action;
