ALTER TYPE "public"."ledger_category" ADD VALUE IF NOT EXISTS 'balls';--> statement-breakpoint
ALTER TYPE "public"."ledger_category" ADD VALUE IF NOT EXISTS 'referee';--> statement-breakpoint
ALTER TYPE "public"."ledger_category" ADD VALUE IF NOT EXISTS 'coach';--> statement-breakpoint
ALTER TABLE "ledger_entries" ADD COLUMN "method" "payment_method";--> statement-breakpoint
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_method_chk" CHECK ("ledger_entries"."method" IS NULL OR "ledger_entries"."method" IN ('cash', 'transfer'));
