-- Откат 0022: возвращает прежний DEFAULT (NULL = отмена до начала). Данные не трогаются:
-- значения срока, проставленные backfill-ом или группами, остаются (отличить их от выбранных вручную нельзя).
ALTER TABLE "organizations" ALTER COLUMN "cancellation_deadline_hours" DROP DEFAULT;
