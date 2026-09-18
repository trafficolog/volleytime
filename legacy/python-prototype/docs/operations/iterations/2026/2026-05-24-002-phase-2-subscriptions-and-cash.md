---
date: 2026-05-24
iteration_number: 002
task_ids:
  - "2.1.1"
  - "2.1.2"
  - "2.1.3"
  - "2.1.4"
  - "2.2.1"
  - "2.2.2"
  - "2.2.3"
  - "2.3.1"
  - "2.3.2"
  - "2.3.3"
  - "2.4.1"
  - "2.4.2"
  - "2.4.3"
  - "2.5.1"
  - "2.5.2"
  - "2.6.1"
  - "2.6.2"
  - "2.7.1"
commit_sha: "<TBD: phase-2 subscriptions and cash payments>"
files_changed: 12
tests_passing: 12
tests_total: 12
---

# Iteration 002: Phase 2 — subscriptions and cash payments

## Что сделано

- `services/subscription.py` (планы, CRUD, atomic consume, restore)
- `services/ledger.py` (income/expense/balance)
- `services/payments.py` (confirm/fail с побочными эффектами)
- `services/notifier.py` (рассылка уведомлений)
- `bot/middlewares.py`: + NotifierMiddleware
- `bot/keyboards.py`: добавлены payment_method_choice, subscription_plans, admin_menu расширен
- `bot/handlers/player/subscriptions.py` — покупка
- `bot/handlers/player/my_bookings.py` — мои записи
- `bot/handlers/player/trainings.py` — переписан под выбор способа оплаты
- `bot/handlers/admin/payments.py` — pending список и подтверждение
- `bot/handlers/admin/ledger.py` — касса + FSM расхода
- `tests/test_subscription_service.py` (7 тестов)

## Затронутые файлы

См. выше. Всего ~12 файлов, ~700 строк кода.

## Тесты

- До: 5 passing
- После: 12 passing
- Новые тесты:
  - `test_plans_consistent`
  - `test_create_pending_subscription`
  - `test_consume_session_atomic`
  - `test_consume_expired_subscription`
  - `test_get_active_excludes_expired`
  - `test_fifo_consumption_chooses_nearest_expiry`
  - `test_restore_session`
  - `test_restore_reactivates_depleted`

## Следующая итерация

- 003: Phase 2 wrap-up — задачи 2.6.3, 2.6.4, 2.7.2, 2.7.3
