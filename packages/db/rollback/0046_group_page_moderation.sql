-- Откат 0046 (24.1.3, R-06, D-08): снимает решения root по страницам групп, жалобы посетителей и
-- счётчик жалоб, отсечённых лимитом.
-- Решение root (скрыта или noindex) — единственное, что держит страницу закрытой: откат при
-- действующем решении молча вернул бы скрытую страницу в поиск. Жалобы — история модерации.
-- Поэтому откат допустим, только пока нет ни решений, ни жалоб; счётчик лимита — статистика
-- без данных о клиентах, он уходит вместе с таблицами.
-- Прежнее приложение таблицы не читает: откат приложения откат схемы не требует, но после отката
-- приложения решения root перестают действовать — сначала «Вернуть» или решение владельца.
-- Обход — решение владельца после `pg_dump -t group_page_moderation -t group_page_complaints`.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "group_page_moderation") THEN
    RAISE EXCEPTION 'rollback 0046 refused: group pages have root moderation decisions';
  END IF;
  IF EXISTS (SELECT 1 FROM "group_page_complaints") THEN
    RAISE EXCEPTION 'rollback 0046 refused: group page complaints are recorded';
  END IF;
END
$$;
DROP TABLE IF EXISTS "group_page_complaint_throttle";
DROP TABLE IF EXISTS "group_page_complaints";
DROP TABLE IF EXISTS "group_page_moderation";
