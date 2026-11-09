-- Откат 0038 (21.2.16): удаляет логотип группы (organization_logos) и колонки organizations.short_link,
-- organizations.logo_updated_at с индексом и CHECK.
-- Откат допустим, только пока нет данных, которые он потерял бы: загруженного логотипа и заданной
-- короткой ссылки. Оба значения организатор вводит вручную; ссылка может уже быть разослана игрокам,
-- логотип восстановить нельзя, поэтому при их наличии схема остаётся (roll-forward). Очистить значения
-- можно только по решению владельца и после
-- `pg_dump -t organization_logos` и выгрузки `SELECT id, short_link FROM organizations`.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "organization_logos")
     OR EXISTS (
       SELECT 1 FROM "organizations"
       WHERE "short_link" IS NOT NULL OR "logo_updated_at" IS NOT NULL
     ) THEN
    RAISE EXCEPTION 'rollback 0038 refused: organization logos or short links exist';
  END IF;
END
$$;
DROP TABLE IF EXISTS "organization_logos";
ALTER TABLE "organizations" DROP CONSTRAINT IF EXISTS "organizations_short_link_format";
DROP INDEX IF EXISTS "organizations_short_link_uniq";
ALTER TABLE "organizations" DROP COLUMN IF EXISTS "logo_updated_at";
ALTER TABLE "organizations" DROP COLUMN IF EXISTS "short_link";
