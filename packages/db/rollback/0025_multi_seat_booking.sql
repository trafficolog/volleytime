-- Откат 0025: удаляет только то, что добавила миграция (места записи, воплощения, освобождённые места).
-- Записи, платежи, касса и аудит R0.7 не удаляются; платежи прошлых воплощений, отменённые миграцией
-- (audit_log 'payment.cancelled_stale_incarnation'), остаются cancelled — это корректное состояние и
-- для R0.7. Откат допустим только когда нет данных нескольких мест: прежний runtime считает записи
-- через count(*) — проверить `SELECT EXISTS (SELECT 1 FROM bookings WHERE seats > 1 OR waitlist_seats > 0)`
-- = false до отката (deploy runbook, ADR «Правила совместимости», п. 4).
DROP TRIGGER IF EXISTS "payments_fill_booking_incarnation" ON "payments";
DROP FUNCTION IF EXISTS "payments_fill_booking_incarnation"();
DROP TRIGGER IF EXISTS "bookings_bump_incarnation" ON "bookings";
DROP FUNCTION IF EXISTS "bookings_bump_incarnation"();
DROP INDEX IF EXISTS "payments_booking_incarnation_idx";
ALTER TABLE "payments" DROP CONSTRAINT IF EXISTS "payments_seat_released_status";
ALTER TABLE "payments" DROP CONSTRAINT IF EXISTS "payments_booking_incarnation_required";
ALTER TABLE "bookings" DROP CONSTRAINT IF EXISTS "bookings_incarnation_positive";
ALTER TABLE "bookings" DROP CONSTRAINT IF EXISTS "bookings_waitlist_seats_status";
ALTER TABLE "bookings" DROP CONSTRAINT IF EXISTS "bookings_waitlist_seats_non_negative";
ALTER TABLE "bookings" DROP CONSTRAINT IF EXISTS "bookings_seats_positive";
ALTER TABLE "payments" DROP COLUMN IF EXISTS "seat_released_at";
ALTER TABLE "payments" DROP COLUMN IF EXISTS "booking_incarnation";
ALTER TABLE "bookings" DROP COLUMN IF EXISTS "incarnation";
ALTER TABLE "bookings" DROP COLUMN IF EXISTS "waitlist_seats";
ALTER TABLE "bookings" DROP COLUMN IF EXISTS "seats";
