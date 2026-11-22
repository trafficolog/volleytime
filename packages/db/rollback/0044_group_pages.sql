-- Откат 0044 (24.1.1, W-13, D-24): снимает таблицу страниц групп.
-- Строка — содержимое, которое написал владелец (тексты, FAQ, порядок секций, мета); строки нет —
-- страница по умолчанию. Откат допустим, только пока ни одна группа страницу не сохраняла:
-- иначе тексты владельцев пропали бы молча.
-- Прежнее приложение таблицу не читает: откат приложения откат схемы не требует.
-- Обход — решение владельца после `pg_dump -t organization_group_pages`.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "organization_group_pages") THEN
    RAISE EXCEPTION 'rollback 0044 refused: group pages have saved content';
  END IF;
END
$$;
DROP TABLE IF EXISTS "organization_group_pages";
