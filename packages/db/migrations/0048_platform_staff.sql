-- 29.3.1 (R-15, D-28): команда платформы с ролями вместо флага `users.is_root_admin`. Текущие root
-- переходят в роль `owner` и продолжают работать без повторного входа (сессии не трогаются). Флаг
-- остаётся в схеме (expand): прежний runtime читает его в окне отката, новый код держит его равным
-- роли `owner`. После отката (0048 rollback удаляет таблицу) повторное применение снова переносит
-- root в `owner`.
CREATE TYPE "public"."platform_staff_role" AS ENUM('owner', 'admin', 'finance', 'moderator', 'support', 'analyst');--> statement-breakpoint
CREATE TABLE "platform_staff" (
	"user_id" integer PRIMARY KEY NOT NULL,
	"role" "platform_staff_role" NOT NULL,
	"invited_by" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "platform_staff" ADD CONSTRAINT "platform_staff_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_staff" ADD CONSTRAINT "platform_staff_invited_by_users_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
INSERT INTO "platform_staff" ("user_id", "role")
SELECT "id", 'owner' FROM "users" WHERE "is_root_admin"
ON CONFLICT ("user_id") DO NOTHING;
