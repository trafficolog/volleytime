-- Откат 0024: удаляет только то, что добавила миграция (баланс событий, журнал, заявки на покупку).
-- События, записи, платежи и касса R0.7 не затрагиваются. После отката журнал баланса теряется;
-- повторное применение заново выдаёт pilot_grant всем организациям (D-12), поэтому откат в production —
-- только по решению владельца с выгрузкой журнала (pg_dump таблиц event_balance_*) до отката.
DROP TABLE IF EXISTS "event_balance_entries";
DROP TABLE IF EXISTS "event_balance_purchase_requests";
DROP TABLE IF EXISTS "organization_event_balances";
DROP TYPE IF EXISTS "public"."purchase_request_status";
DROP TYPE IF EXISTS "public"."event_balance_reason";
DROP TYPE IF EXISTS "public"."event_balance_actor";
