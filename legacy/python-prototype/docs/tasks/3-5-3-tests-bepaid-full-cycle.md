---
id: "3.5.3"
phase: 3
epic: "3.5"
status: todo
sync_state: drifted
last_reviewed: 2026-05-25
status_note: ""
roles:
  - QA
depends_on:
  - "3.5.1"
  - "3.5.2"
  - "3.3.2"
estimated_hours: "2-3"
tags:
  - tests
  - integration
  - bepaid
---

# Task 3.5.3: Интеграционный тест полного цикла оплаты

## Цель

End-to-end интеграционный тест с мокнутым `BePaidClient` и `Notifier`. Проверяет цепочку: пользователь жмёт «Оплатить картой» → создаётся payment → bePaid client возвращает токен → webhook приходит → Payment confirmed → Booking confirmed → ledger зафиксирован → пользователь получает уведомление.

## Контекст

Точечные тесты (3.5.1, 3.5.2) и тесты Phase 2 (`test_payment_flow.py`) покрывают части, но не всю цепочку. Этот тест ловит регрессии в склейке.

## Что должно быть сделано

- В `tests/test_bepaid_e2e.py` (новый файл):
  - **test_full_payment_flow_for_training**:
    1. Setup: пользователь, тренировка, мокнутый BePaidClient (`create_checkout` возвращает `CheckoutResult(token="t1", redirect_url="https://...")`)
    2. Вызываем хендлер `booking:pay:bepaid:card:<training_id>`
    3. Проверяем: `Payment.status=pending`, `bepaid_token="t1"`, `Booking.status=pending_payment`
    4. Симулируем webhook с подписью (использует фикстуру из 3.5.1)
    5. Проверяем после webhook: `Payment.status=succeeded`, `bepaid_uid="abc-123"`, `Booking.status=confirmed`, `LedgerEntry` создана, Notifier вызван
  - **test_full_payment_flow_for_subscription**: аналогично, но для покупки абонемента
  - **test_payment_fails_via_webhook**:
    1. Payment создан
    2. Webhook с `status=failed`
    3. `Payment.status=failed`, `Booking.status=cancelled`, Notifier вызван с сообщением об отказе
  - **test_bepaid_client_error_rollback**:
    1. BePaidClient мокнут так, что `create_checkout` бросает `BePaidClientError(500, "...")`
    2. Хендлер должен откатить созданный Booking и показать пользователю сообщение
    3. Booking.status=cancelled, Payment не создаётся

## Критерии приёмки

- 4 теста проходят
- Все тесты на in-memory SQLite, без реального bePaid
- Тесты Phase 3 (3.5.1 + 3.5.2 + 3.5.3) в сумме покрывают webhook-флоу + UX-хендлеры на 90%+

## Подсказки

- Mocks: `from unittest.mock import AsyncMock`. Подменить `BePaidClient` через DI или monkey-patch.
- Имитация подписанного webhook'а: использовать ту же фикстуру `bepaid_keypair`, подписать тело, передать сигнатуру в заголовке.
- Если хендлеры написаны идиоматично (через сервисы и middleware) — тесты пишутся прямолинейно.

## Не делать

- Не подключать реальный bePaid sandbox в этих тестах — они должны быть быстрыми и стабильными.
- Не покрывать UI Telegram (типа «нажата кнопка X»). Только сервисы и обработчики.
