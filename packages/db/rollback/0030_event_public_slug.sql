-- Откат 0030 (20.6.1): удаляет `events.public_slug` — идентификатор публичной страницы события.
-- Прежний runtime публичной страницы не знает, но после повторного применения миграции каждому
-- событию выдаётся НОВЫЙ случайный идентификатор: уже разосланные ссылки перестанут открываться
-- (ссылка = доступ, восстановить старое значение нельзя). Поэтому откат допустим только когда
-- ссылки живых событий не в обращении — нет опубликованных или закрытых событий, которые ещё не
-- закончились:
--   SELECT EXISTS (SELECT 1 FROM events WHERE status IN ('published', 'closed')
--                    AND ends_at > now()) -- = false
-- Прошедшие, отменённые и черновые события откат не блокируют: их ссылки не нужны или не выдавались.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "events"
    WHERE "status" IN ('published', 'closed') AND "ends_at" > now()
  ) THEN
    RAISE EXCEPTION 'rollback 0030 refused: live events have shared public links';
  END IF;
END
$$;
DROP INDEX IF EXISTS "events_public_slug_uniq";
ALTER TABLE "events" DROP COLUMN IF EXISTS "public_slug";
