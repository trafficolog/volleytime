-- Откат 0031 (20.3.4): удаляет привязки Telegram-чатов к группам и одноразовые коды привязки.
-- Привязку нельзя восстановить: чат подтверждается кодом и администратором чата, поэтому после
-- повторного применения миграции организаторы привязывали бы чаты заново. Откат допустим, только
-- когда привязок в обращении нет (строки `unlinked` — история, коды — одноразовые и короткоживущие):
--   SELECT EXISTS (SELECT 1 FROM organization_telegram_chats WHERE status <> 'unlinked') -- = false
-- Прежний runtime таблиц не знает, поэтому на работу приложения откат не влияет, но удалённые
-- привязки теряют анонсы в чат. Если откат нужен несмотря на привязки (решение оператора):
-- `pg_dump -t organization_telegram_chats` во внешний файл, затем
--   UPDATE organization_telegram_chats SET status = 'unlinked', invalid_reason = NULL,
--     unlink_reason = 'organizer', unlinked_at = now() WHERE status <> 'unlinked';
-- и откат в одной транзакции (`pnpm db:rollback`).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "organization_telegram_chats" WHERE "status" <> 'unlinked') THEN
    RAISE EXCEPTION 'rollback 0031 refused: Telegram chats are linked to groups';
  END IF;
END
$$;
DROP TABLE IF EXISTS "telegram_chat_link_codes";
DROP TABLE IF EXISTS "organization_telegram_chats";
DROP TYPE IF EXISTS "telegram_chat_link_status";
