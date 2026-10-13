ALTER TABLE "organizations" ALTER COLUMN "cancellation_deadline_hours" SET DEFAULT 6;--> statement-breakpoint
-- Backfill (R0.7): срок отмены раньше задавался у события (форма — 6 ч по умолчанию). Группа без срока получает самый
-- частый ненулевой срок своих событий, а без таких событий — 6, чтобы новые события не стали «отмена до начала».
UPDATE "organizations" o SET "cancellation_deadline_hours" = COALESCE((
  SELECT e."cancellation_deadline_hours" FROM "events" e
  WHERE e."organization_id" = o."id" AND e."cancellation_deadline_hours" IS NOT NULL
  GROUP BY e."cancellation_deadline_hours"
  ORDER BY count(*) DESC, e."cancellation_deadline_hours" DESC LIMIT 1
), 6) WHERE o."cancellation_deadline_hours" IS NULL;
