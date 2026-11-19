-- Откат 0041 (22.2.1, ADR-22-2-1): снимает каталог пакетов баланса событий и связь заявок с пакетом.
-- Откат допустим, только пока каталог в точности равен сиду миграции и все связи заявок — от её
-- бэкфилла: тогда снятие колонки теряет лишь информацию, которую бэкфилл восстановит.
-- Отказ (RAISE EXCEPTION), если истинно любое:
--   1. в таблице не три строки или есть код вне events_10 / events_30 / events_100;
--   2. для одного из трёх кодов отличается хотя бы одна колонка от сида (IS DISTINCT FROM, NULL-безопасно);
--   3. есть заявка с package_id, созданная не раньше сида (связь поставлена новым кодом), или связанная
--      заявка, чей снимок (units, amount, currency) отличается от сида пакета.
-- Прежнее приложение (v0.3.x) каталог не читает: откат приложения откат схемы не требует.
-- Обход — решение владельца после `pg_dump -t event_balance_packages -t event_balance_purchase_requests`.
DO $$
DECLARE
  seed_moment timestamptz;
BEGIN
  IF (SELECT count(*) FROM "event_balance_packages") <> 3
     OR EXISTS (
       SELECT 1 FROM "event_balance_packages"
       WHERE "code" NOT IN ('events_10', 'events_30', 'events_100')
     ) THEN
    RAISE EXCEPTION 'rollback 0041 refused: package catalog differs from the seed (rows)';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM (VALUES
      ('events_10', 10, 5000, 'BYN', NULL::text, true, 10),
      ('events_30', 30, 12000, 'BYN', 'popular', true, 20),
      ('events_100', 100, 35000, 'BYN', NULL::text, true, 30)
    ) AS s("code", "units", "amount", "currency", "badge", "visible", "sort_order")
    LEFT JOIN "event_balance_packages" p ON p."code" = s."code"
    WHERE p."id" IS NULL
       OR p."units" IS DISTINCT FROM s."units"
       OR p."amount" IS DISTINCT FROM s."amount"
       OR p."currency" IS DISTINCT FROM s."currency"
       OR p."badge" IS DISTINCT FROM s."badge"
       OR p."visible" IS DISTINCT FROM s."visible"
       OR p."archived_at" IS NOT NULL
       OR p."sort_order" IS DISTINCT FROM s."sort_order"
       OR p."version" IS DISTINCT FROM 1
  ) THEN
    RAISE EXCEPTION 'rollback 0041 refused: package catalog differs from the seed (values)';
  END IF;

  SELECT min("created_at") INTO seed_moment FROM "event_balance_packages";

  IF EXISTS (
    SELECT 1
    FROM "event_balance_purchase_requests" r
    JOIN "event_balance_packages" p ON p."id" = r."package_id"
    WHERE r."created_at" >= seed_moment
       OR (r."units", r."amount", r."currency") IS DISTINCT FROM (p."units", p."amount", p."currency")
  ) THEN
    RAISE EXCEPTION 'rollback 0041 refused: purchase requests linked to packages after the migration';
  END IF;
END
$$;
ALTER TABLE "event_balance_purchase_requests" DROP CONSTRAINT IF EXISTS "event_balance_requests_package_id_fk";
DROP INDEX IF EXISTS "event_balance_purchase_requests_package_idx";
ALTER TABLE "event_balance_purchase_requests" DROP COLUMN IF EXISTS "package_id";
DROP TABLE IF EXISTS "event_balance_packages";
