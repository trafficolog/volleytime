-- 20.1.2 (P-05, ADR v3 «Места в записи», «Денежная модель нескольких мест», D-14).
-- Только добавление: колонки с константным DEFAULT (без перезаписи таблицы), NULL-колонки, CHECK и
-- триггеры. Порядок: колонки → backfill → ограничения, чтобы CHECK проверялся на уже заполненных данных.
ALTER TABLE "bookings" ADD COLUMN "seats" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "waitlist_seats" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "incarnation" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "booking_incarnation" integer;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "seat_released_at" timestamp with time zone;--> statement-breakpoint
-- backfill (20.1.2): все записи R0.7 — воплощение 1. Платёж, на который указывает bookings.payment_id,
-- — текущее воплощение (1); прочие платежи той же записи — прошлые воплощения (0). Так у каждой записи
-- R0.7 не больше одного живого платежа — того же, что проверял код 6.8.5.
UPDATE "payments" p
SET "booking_incarnation" = CASE WHEN b."payment_id" = p."id" THEN 1 ELSE 0 END
FROM "bookings" b
WHERE b."id" = p."booking_id" AND p."booking_incarnation" IS NULL;--> statement-breakpoint
-- pending-платежи прошлых воплощений не остаются в «ждут оплаты»: cancelled + запись аудита на каждый.
WITH stale AS (
  UPDATE "payments" SET "status" = 'cancelled'
  WHERE "booking_incarnation" = 0 AND "status" = 'pending'
  RETURNING "id", "organization_id"
)
INSERT INTO "audit_log" ("organization_id", "user_id", "action", "entity_type", "entity_id", "old_value", "new_value")
SELECT s."organization_id", NULL, 'payment.cancelled_stale_incarnation', 'payment', s."id",
  '{"status":"pending"}'::jsonb,
  '{"status":"cancelled","source":"migration:0025_multi_seat_booking"}'::jsonb
FROM stale s;--> statement-breakpoint
-- D-14: оплаченное место отменённой игроком записи R0.7 (6.8.6) — «оплачено, место освобождено».
UPDATE "payments" p
SET "seat_released_at" = COALESCE(b."cancelled_at", b."updated_at")
FROM "bookings" b
WHERE b."id" = p."booking_id" AND b."status" = 'cancelled'
  AND p."booking_incarnation" = 1 AND p."status" = 'succeeded' AND p."seat_released_at" IS NULL;--> statement-breakpoint
-- оплаченные платежи прошлых воплощений тоже не живые: момент отмены не хранится, берём подтверждение.
UPDATE "payments"
SET "seat_released_at" = COALESCE("confirmed_at", "created_at")
WHERE "booking_incarnation" = 0 AND "status" = 'succeeded' AND "seat_released_at" IS NULL;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_seats_positive" CHECK ("bookings"."seats" >= 1);--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_waitlist_seats_non_negative" CHECK ("bookings"."waitlist_seats" >= 0);--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_waitlist_seats_status" CHECK ("bookings"."waitlist_seats" = 0 OR "bookings"."status" IN ('confirmed', 'pending_payment'));--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_incarnation_positive" CHECK ("bookings"."incarnation" >= 1);--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_booking_incarnation_required" CHECK ("payments"."booking_id" IS NULL OR "payments"."booking_incarnation" IS NOT NULL);--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_seat_released_status" CHECK ("payments"."seat_released_at" IS NULL OR "payments"."status" IN ('succeeded', 'refunded'));--> statement-breakpoint
-- Воплощение растёт при каждой реактивации отменённой записи — в БД, поэтому одинаково для нового и
-- прежнего приложения (окно отката): прежний runtime реактивирует ту же строку и не знает колонки.
CREATE OR REPLACE FUNCTION "bookings_bump_incarnation"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD."status" = 'cancelled' AND NEW."status" <> 'cancelled' THEN
    NEW."incarnation" := OLD."incarnation" + 1;
  END IF;
  RETURN NEW;
END
$$;--> statement-breakpoint
CREATE TRIGGER "bookings_bump_incarnation" BEFORE UPDATE OF "status" ON "bookings"
FOR EACH ROW EXECUTE FUNCTION "bookings_bump_incarnation"();--> statement-breakpoint
-- Прежний runtime создаёт платёж записи без booking_incarnation: триггер подставляет текущее воплощение,
-- поэтому CHECK payments_booking_incarnation_required не ломает его INSERT.
CREATE OR REPLACE FUNCTION "payments_fill_booking_incarnation"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."booking_id" IS NOT NULL AND NEW."booking_incarnation" IS NULL THEN
    SELECT b."incarnation" INTO NEW."booking_incarnation" FROM "bookings" b WHERE b."id" = NEW."booking_id";
  END IF;
  RETURN NEW;
END
$$;--> statement-breakpoint
CREATE TRIGGER "payments_fill_booking_incarnation" BEFORE INSERT ON "payments"
FOR EACH ROW EXECUTE FUNCTION "payments_fill_booking_incarnation"();--> statement-breakpoint
-- живые платежи записи читаются по (booking_id, booking_incarnation)
CREATE INDEX "payments_booking_incarnation_idx" ON "payments" USING btree ("booking_id","booking_incarnation");
