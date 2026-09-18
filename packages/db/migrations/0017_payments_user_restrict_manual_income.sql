ALTER TYPE "public"."ledger_category" ADD VALUE 'donation';--> statement-breakpoint
ALTER TYPE "public"."ledger_category" ADD VALUE 'sponsorship';--> statement-breakpoint
ALTER TYPE "public"."ledger_category" ADD VALUE 'other_income';--> statement-breakpoint
ALTER TABLE "payments" DROP CONSTRAINT "payments_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;