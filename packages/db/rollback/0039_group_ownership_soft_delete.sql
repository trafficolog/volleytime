-- Откат 0039 (21.2.17): удаляет таблицу organization_ownership_transfers, колонки
-- organizations.deleted_at / restore_until с CHECK и частичный уникальный индекс «один owner на
-- группу» (organization_members.role = 'owner').
-- Откат допустим, только пока нет данных, которые он потерял бы или исказил:
--  * удалённой группы (deleted_at задан): без колонки она молча вернулась бы участникам, запись,
--    оплата и планировщик снова заработали бы — это нарушает решение D-15 (деньги в окне не меняются);
--  * ожидающей передачи владения: получатель держит ссылку, которая перестала бы работать без следа.
-- Принятые, отменённые и истёкшие передачи — история; она остаётся в audit_log и откат не блокирует.
-- Восстановить удалённые группы (`UPDATE organizations SET deleted_at = NULL, restore_until = NULL`)
-- или отменить ожидающие передачи можно только по решению владельца и после
-- `pg_dump -t organization_ownership_transfers` и выгрузки
-- `SELECT id, deleted_at, restore_until FROM organizations WHERE deleted_at IS NOT NULL`.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "organizations" WHERE "deleted_at" IS NOT NULL)
     OR EXISTS (SELECT 1 FROM "organization_ownership_transfers" WHERE "status" = 'pending') THEN
    RAISE EXCEPTION 'rollback 0039 refused: deleted groups or pending ownership transfers exist';
  END IF;
END
$$;
DROP INDEX IF EXISTS "org_members_one_owner_uniq";
DROP TABLE IF EXISTS "organization_ownership_transfers";
ALTER TABLE "organizations" DROP CONSTRAINT IF EXISTS "organizations_deleted_restore_chk";
ALTER TABLE "organizations" DROP COLUMN IF EXISTS "restore_until";
ALTER TABLE "organizations" DROP COLUMN IF EXISTS "deleted_at";
