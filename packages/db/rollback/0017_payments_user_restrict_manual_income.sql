-- значения enum ledger_category (donation, sponsorship, other_income) PostgreSQL удалить не позволяет — остаются
ALTER TABLE "payments" DROP CONSTRAINT IF EXISTS "payments_user_id_users_id_fk";
ALTER TABLE "payments" ADD CONSTRAINT "payments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
