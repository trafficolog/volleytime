-- Откат 0028 (20.3.1): удаляет время открытия и срок закрытия записи, предложения мест из листа
-- ожидания и журнал задач планировщика. Откат стёр бы новую семантику данных, которую прежний
-- runtime понимает неверно (ADR v3, «Правила совместимости», п. 4): будущее время открытия записи
-- (прежний runtime открыл бы запись сразу) и активные предложения мест (их места считаются
-- занятыми). Поэтому откат допустим только когда таких данных нет — планировщик выключен
-- (`SCHEDULER_ENABLED` не `true`), активных предложений нет и запись нигде не ждёт открытия:
--   SELECT EXISTS (SELECT 1 FROM waitlist_offers WHERE status = 'offered')
--       OR EXISTS (SELECT 1 FROM events WHERE booking_opens_at > now()
--                    AND status IN ('draft', 'published', 'closed')) -- = false
-- Прошедшее время открытия откат не блокирует: запись уже открыта, прежний runtime ведёт себя так же.
-- `close_before_minutes` удаляется: прежний runtime не закрывает запись автоматически. Журнал
-- `scheduled_jobs` — операционный (очередь уведомлений), денег не содержит; история закрытых
-- предложений и журнал удаляются вместе с таблицами.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "waitlist_offers" WHERE "status" = 'offered') THEN
    RAISE EXCEPTION 'rollback 0028 refused: active waitlist offers exist';
  END IF;
  IF EXISTS (
    SELECT 1 FROM "events"
    WHERE "booking_opens_at" > now() AND "status" IN ('draft', 'published', 'closed')
  ) THEN
    RAISE EXCEPTION 'rollback 0028 refused: live events wait for booking_opens_at';
  END IF;
END
$$;
ALTER TABLE "events" DROP CONSTRAINT IF EXISTS "events_close_before_minutes_allowed";
ALTER TABLE "events" DROP CONSTRAINT IF EXISTS "events_booking_opens_before_start";
ALTER TABLE "events" DROP COLUMN IF EXISTS "close_before_minutes";
ALTER TABLE "events" DROP COLUMN IF EXISTS "booking_opens_at";
DROP TABLE IF EXISTS "scheduled_jobs";
DROP TABLE IF EXISTS "waitlist_offers";
DROP TYPE IF EXISTS "public"."scheduled_job_status";
DROP TYPE IF EXISTS "public"."waitlist_offer_status";
