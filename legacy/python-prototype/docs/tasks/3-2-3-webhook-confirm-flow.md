---
id: "3.2.3"
phase: 3
epic: "3.2"
status: todo
sync_state: drifted
last_reviewed: 2026-05-25
status_note: ""
roles:
  - BACK
  - WEB
depends_on:
  - "3.2.1"
  - "3.2.2"
estimated_hours: "2-3"
tags:
  - bepaid
  - webhook
  - integration
---

# Task 3.2.3: Подтверждение Booking/Subscription через PaymentService

## Цель

После прохождения парсинга (3.2.1), проверки подписи (3.4.1) и идемпотентности (3.2.2) — собрать всё вместе: вызвать `PaymentService.confirm(payment_id)` или `.fail(payment_id)`, который уже умеет правильно подтверждать связанные сущности и писать в кассу.

## Контекст

`PaymentService` (Phase 2) уже умеет делать всё, что нужно:
- При confirm: активировать subscription, перевести booking в confirmed, записать income в ledger.
- При fail: отменить связанный booking.

Webhook просто диспетчеризует решение и зовёт нужный метод. Никакой бизнес-логики в webhook — только обработка протокола.

После confirm/fail — отправить пользователю Telegram-уведомление через `Notifier`.

## Что должно быть сделано

- В `src/web/bepaid_webhook.py` собрать всю цепочку:
  1. Принять запрос → проверить подпись (3.4.1) → вернуть 403 при ошибке
  2. Парсить payload (3.2.1) → вернуть 400 при невалидном JSON
  3. Найти `Payment` по `tracking_id` → если не найден, логировать warning, вернуть 200
  4. Применить идемпотентность (3.2.2) → если duplicate, вернуть 200
  5. Сравнить `webhook.amount` с `payment.amount` — если расходятся, логировать warning, вернуть 200 (защита от подмены)
  6. По `webhook.status`:
     - `successful` → `PaymentService.confirm(payment_id)`
     - `failed`, `error` → `PaymentService.fail(payment_id, reason=...)`
     - `pending` → обновить `bepaid_status`, ничего не подтверждать, вернуть 200
  7. После успешного confirm/fail — отправить уведомление пользователю через Notifier
  8. `await session.commit()` → вернуть 200

- Структурированное логирование на каждом шаге: `event="webhook_received"`, `event="webhook_processed"`, `event="webhook_rejected"`.

- Обработка исключений:
  - Любая необработанная — вернуть 500, bePaid будет ретраить (это норма)
  - `PaymentAlreadyProcessedError` — это нормально (race condition), вернуть 200
  - В logs — полный traceback

## Критерии приёмки

- Тест: симуляция webhook `successful` для cash-платежа → `Payment.status == succeeded`, в кассе LedgerEntry, пользователь получил TG-уведомление (mock Notifier)
- Тест: симуляция webhook `failed` → `Payment.status == failed`, `Booking.status == cancelled`, пользователь получил уведомление об отказе
- Тест: симуляция webhook `pending` → ничего не изменилось, только `Payment.bepaid_status = "pending"`
- Тест: webhook с amount, отличающимся от payment.amount → 200, warning в логах, статус НЕ меняется
- Интеграционный тест полного цикла (3.5.3) проходит

## Подсказки

- DI Notifier: aiohttp app получает его через `app["notifier"]`. Прокинуть при startup.
- Сессия БД: создаётся внутри обработчика через `async_session_maker()`, не через middleware (т.к. webhook — отдельное приложение).
- Если возникнет ошибка между confirm и notify — confirm уже сделан, повторный webhook сработает на idempotency, юзер получит уведомление при следующем входе (это допустимо).

## Не делать

- Не реализовывать confirm/fail-логику здесь. Только вызовы `PaymentService`.
- Не делать аналитику webhook'ов (типа отчёт «сколько прошло/failed за день») — Phase 5.
- Не отправлять уведомления админу через каждый webhook — спам. Только пользователю.
