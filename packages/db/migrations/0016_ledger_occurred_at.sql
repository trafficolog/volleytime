ALTER TABLE "ledger_entries" ADD COLUMN "occurred_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
UPDATE "ledger_entries" SET "occurred_at" = "created_at";
