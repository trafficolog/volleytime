-- Откат 0036 (21.2.11): удаляет способы оплаты группы (включение и реквизиты перевода).
-- Откат допустим, только пока нет данных, которые он потерял бы: выключенных способов и
-- введённых реквизитов (банк, последние 4 цифры, получатель). Строки без отклонений от умолчания
-- (способ включён, реквизитов нет) эквивалентны отсутствию строки и удаляются без потерь.
-- Реквизиты организатор вводит вручную, восстановить их нельзя, поэтому при их наличии схема
-- остаётся (roll-forward). Очистить таблицу можно только по решению владельца и после
-- `pg_dump -t organization_payment_methods`.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "organization_payment_methods"
    WHERE "enabled" = false OR "bank" IS NOT NULL OR "card_last4" IS NOT NULL OR "recipient" IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'rollback 0036 refused: organization payment methods with settings exist';
  END IF;
END
$$;
DROP TABLE IF EXISTS "organization_payment_methods";
