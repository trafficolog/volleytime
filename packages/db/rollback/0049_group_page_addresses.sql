-- Откат 0049 (24.2.1, D-26): снимает историю адресов страниц групп.
-- История — единственный источник 301 со старых адресов `/{город}/{группа}` после смены города или
-- slug; откат допустим, только пока записей нет: иначе старые ссылки молча стали бы 404.
-- Прежнее приложение таблицу не читает: откат приложения откат схемы не требует.
-- Обход — решение владельца после `pg_dump -t group_page_addresses`.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "group_page_addresses") THEN
    RAISE EXCEPTION 'rollback 0049 refused: group page address history is recorded';
  END IF;
END
$$;
DROP TABLE IF EXISTS "group_page_addresses";
