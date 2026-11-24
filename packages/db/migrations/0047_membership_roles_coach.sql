-- 30.1.1 (P-18, D-31): роль «Помощник» (`assistant`) становится тренером (`coach`). Переименование
-- значения enum переводит всех помощников и приглашения с этой ролью в тренеров без приёма оплаты
-- и не перестраивает таблицы. После отката (0047 rollback возвращает строки в `assistant`, значение
-- `coach` остаётся в enum) повторное применение переводит строки обновлением.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'member_role' AND e.enumlabel = 'coach'
  ) THEN
    ALTER TYPE "public"."member_role" RENAME VALUE 'assistant' TO 'coach';
  ELSE
    UPDATE "organization_members" SET "role" = 'coach' WHERE "role"::text = 'assistant';
    UPDATE "invite_links" SET "role_to_assign" = 'coach' WHERE "role_to_assign"::text = 'assistant';
  END IF;
END
$$;--> statement-breakpoint
-- Прежний runtime ещё знает только `assistant` и может записать его в окне отката приложения:
-- значение возвращается в конец enum (expand); новый код его не пишет и читает как `coach`.
ALTER TYPE "public"."member_role" ADD VALUE IF NOT EXISTS 'assistant';--> statement-breakpoint
ALTER TABLE "organization_members" ADD COLUMN "can_accept_payment" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "coach_user_ids" integer[] DEFAULT '{}'::integer[] NOT NULL;
