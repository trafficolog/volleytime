-- Откат 0026 (20.1.3): удаляет режим записи события, запросы приглашения и связь записи с приглашением.
-- Прежний runtime не проверяет join_mode: откат допустим только когда нет действующих событий
-- «по приглашению» — проверить `SELECT EXISTS (SELECT 1 FROM events WHERE join_mode = 'invite'
-- AND status NOT IN ('cancelled', 'finished'))` = false и нет живых токенов приглашений на событие
-- (не отозван, не истёк, остались использования) — ADR v3, «Правила совместимости», п. 4; ревью PR #136.
-- Приглашения на событие (`type = 'event_join'`) удаляются: прежний `POST /api/invites/{token}/redeem`
-- не различает тип и принял бы такой токен как вступление в группу; без event_id-FK они бы ещё и
-- мешали повторному применению 0026. История выдачи остаётся в audit_log.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "events"
    WHERE "join_mode" = 'invite' AND "status" NOT IN ('cancelled', 'finished')
  ) THEN
    RAISE EXCEPTION 'rollback 0026 refused: active events with join_mode = invite exist';
  END IF;
  IF EXISTS (
    SELECT 1 FROM "invite_links"
    WHERE "type" = 'event_join' AND NOT "is_revoked"
      AND ("expires_at" IS NULL OR "expires_at" > now())
      AND ("max_uses" IS NULL OR "uses_count" < "max_uses")
  ) THEN
    RAISE EXCEPTION 'rollback 0026 refused: live event_join invite tokens exist';
  END IF;
END
$$;
ALTER TABLE "bookings" DROP CONSTRAINT IF EXISTS "bookings_invite_id_invite_links_id_fk";
DROP TABLE IF EXISTS "event_invite_requests";
DELETE FROM "invite_links" WHERE "type" = 'event_join';
ALTER TABLE "invite_links" DROP CONSTRAINT IF EXISTS "invite_links_event_join_event";
DROP INDEX IF EXISTS "invite_links_event_idx";
ALTER TABLE "invite_links" DROP CONSTRAINT IF EXISTS "invite_links_event_id_events_id_fk";
DROP TYPE IF EXISTS "public"."invite_request_status";
ALTER TABLE "bookings" DROP COLUMN IF EXISTS "invite_id";
ALTER TABLE "events" DROP COLUMN IF EXISTS "join_mode";
