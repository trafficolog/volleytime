-- Откат 0048 (29.3.1, R-15, D-28): команда платформы возвращается во флаг `users.is_root_admin`.
-- Прежний runtime знает только root (= owner): флаг становится равен роли `owner`, таблица и тип
-- удаляются. Роли admin, finance, moderator, support и analyst прежний runtime хранить не умеет:
-- откат молча снял бы доступ этим людям или выдал бы им полный root. Поэтому откат допустим, только
-- пока в команде нет никого, кроме owner. Обход — решение владельца после `pg_dump -t platform_staff`.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "platform_staff" WHERE "role" <> 'owner') THEN
    RAISE EXCEPTION 'rollback 0048 refused: platform staff has non-owner roles';
  END IF;
END
$$;
UPDATE "users" SET "is_root_admin" = EXISTS (
  SELECT 1 FROM "platform_staff" s WHERE s."user_id" = "users"."id" AND s."role" = 'owner'
) WHERE "is_root_admin" IS DISTINCT FROM EXISTS (
  SELECT 1 FROM "platform_staff" s WHERE s."user_id" = "users"."id" AND s."role" = 'owner'
);
DROP TABLE IF EXISTS "platform_staff";
DROP TYPE IF EXISTS "public"."platform_staff_role";
