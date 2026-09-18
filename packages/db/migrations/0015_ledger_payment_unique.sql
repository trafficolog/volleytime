-- 6.8.1: удалить дубли дохода/возврата по одному платежу (гонка v0.1.0), оставить первую запись
DELETE FROM "ledger_entries" le USING "ledger_entries" dup
WHERE le."payment_id" IS NOT NULL AND le."payment_id" = dup."payment_id"
  AND le."type" = 'income' AND dup."type" = 'income' AND le."id" > dup."id";--> statement-breakpoint
DELETE FROM "ledger_entries" le USING "ledger_entries" dup
WHERE le."payment_id" IS NOT NULL AND le."payment_id" = dup."payment_id"
  AND le."category" = 'refund' AND dup."category" = 'refund' AND le."id" > dup."id";--> statement-breakpoint
CREATE UNIQUE INDEX "ledger_income_payment_uniq" ON "ledger_entries" USING btree ("payment_id") WHERE "ledger_entries"."type" = 'income' AND "ledger_entries"."payment_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "ledger_refund_payment_uniq" ON "ledger_entries" USING btree ("payment_id") WHERE "ledger_entries"."category" = 'refund' AND "ledger_entries"."payment_id" IS NOT NULL;