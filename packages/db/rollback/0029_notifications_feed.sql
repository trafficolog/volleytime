-- Откат 0029 (20.3.2): удаляет хранимую ленту уведомлений, тихие часы и признак недоступности бота.
-- Лента — пользовательские данные (история уведомлений и их статус доставки), тихие часы — настройка
-- игрока: откат стёр бы их без возможности восстановления. Поэтому откат допустим только когда
-- данных нет:
--   SELECT EXISTS (SELECT 1 FROM notifications)
--       OR EXISTS (SELECT 1 FROM users WHERE quiet_hours_start IS NOT NULL) -- = false
-- Если данные есть, оператор сначала сохраняет их (`pg_dump -t notifications`) и очищает
-- (`DELETE FROM notifications; UPDATE users SET quiet_hours_start = NULL, quiet_hours_end = NULL`) —
-- это решение оператора. Признак `bot_blocked_at` не блокирует откат: он восстанавливается при
-- следующей неудачной отправке. Задачи журнала `scheduled_jobs` с `notificationId` в payload прежний
-- runtime доставляет как обычные уведомления (поле игнорируется).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "notifications") THEN
    RAISE EXCEPTION 'rollback 0029 refused: notifications exist';
  END IF;
  IF EXISTS (SELECT 1 FROM "users" WHERE "quiet_hours_start" IS NOT NULL) THEN
    RAISE EXCEPTION 'rollback 0029 refused: quiet hours are set';
  END IF;
END
$$;
ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "users_quiet_hours_range";
ALTER TABLE "users" DROP COLUMN IF EXISTS "bot_blocked_at";
ALTER TABLE "users" DROP COLUMN IF EXISTS "quiet_hours_end";
ALTER TABLE "users" DROP COLUMN IF EXISTS "quiet_hours_start";
DROP TABLE IF EXISTS "notifications";
DROP TYPE IF EXISTS "public"."notification_delivery_status";
DROP TYPE IF EXISTS "public"."notification_type";
