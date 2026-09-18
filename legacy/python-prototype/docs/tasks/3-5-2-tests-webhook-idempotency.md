---
id: "3.5.2"
phase: 3
epic: "3.5"
status: todo
sync_state: drifted
last_reviewed: 2026-05-25
status_note: ""
roles:
  - QA
depends_on:
  - "3.2.2"
estimated_hours: "1-2"
tags:
  - tests
  - bepaid
  - idempotency
---

# Task 3.5.2: Тест идемпотентности webhook

## Цель

Тест, который гарантирует: один и тот же webhook, отправленный 2+ раз, обрабатывается как одно событие. В кассе одна запись, пользователь получает одно уведомление.

## Контекст

Без этого теста риск регрессии очень высок: при доработках обработчика легко сломать защиту, и баг проявится только в проде при retry от bePaid.

## Что должно быть сделано

- В `tests/test_payment_flow.py` (или новый `tests/test_webhook_flow.py`) добавить:
  - **test_duplicate_webhook_creates_single_ledger_entry**:
    1. Создаём User, Booking в pending, Payment в pending
    2. Симулируем приход webhook через мок (или через `aiohttp.test_utils.make_mocked_request`): `status=successful`, `bepaid_uid="abc-123"`
    3. После первого вызова: `LedgerEntry` ровно 1, `Payment.status=succeeded`, `Booking.status=confirmed`
    4. Симулируем тот же webhook второй раз
    5. Проверки: `LedgerEntry` всё ещё 1, статусы не изменились, mock Notifier вызван ровно 1 раз
  - **test_webhook_with_different_uid_for_same_payment_rejected**:
    1. Payment с уже сохранённым `bepaid_uid="abc-123"`, статус succeeded
    2. Приходит webhook с тем же `tracking_id`, но `bepaid_uid="xyz-456"`
    3. Должен быть 200, но без побочных эффектов, и warning в логах
  - **test_webhook_for_unknown_payment_returns_200**:
    1. Приходит webhook с `tracking_id="payment_99999"` (не существует)
    2. Ответ 200, в логах warning, никаких побочных эффектов
  - **test_webhook_amount_mismatch_rejected**:
    1. Payment с amount=15.00 BYN, webhook с amount=1.00 BYN (100 копеек)
    2. Ответ 200, статус Payment НЕ меняется, warning

## Критерии приёмки

- 4+ тестов проходят
- Mock'и Notifier и BePaidClient изолируют тест от внешних зависимостей
- Тест запускается на in-memory SQLite в < 1 секунду

## Подсказки

- Mock Notifier: можно собрать через `AsyncMock` или сделать простую заглушку с `sent: list[tuple[int, str]]`.
- Транзакции БД: каждый тест получает свежую сессию через фикстуру (как уже сделано в Phase 2).
- Для симуляции webhook-вызова не обязательно поднимать aiohttp — можно напрямую вызвать функцию-обработчик, передав request-объект через `make_mocked_request`.

## Не делать

- Не делать тест с реальным HTTP-сервером — медленно и излишне.
- Не тестируем здесь подпись (это в 3.5.1) — мокаем `verify_bepaid_signature` всегда → True.
