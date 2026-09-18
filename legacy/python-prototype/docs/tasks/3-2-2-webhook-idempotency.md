---
id: "3.2.2"
phase: 3
epic: "3.2"
status: todo
sync_state: drifted
last_reviewed: 2026-05-25
status_note: ""
roles:
  - BACK
depends_on:
  - "3.2.1"
estimated_hours: "2"
tags:
  - bepaid
  - webhook
  - idempotency
---

# Task 3.2.2: Идемпотентность webhook по bepaid_uid

## Цель

Защитить webhook от дублей: одно событие обрабатывается ровно один раз. Дубликаты (которые bePaid может прислать 2-3 раза при сетевых проблемах) возвращают 200, но не создают побочных эффектов.

## Контекст

Без идемпотентности:
- Игрок получит двойное уведомление «оплата подтверждена».
- В кассу попадёт двойное поступление.
- При retry на ошибке (если первый запрос упал на 500) — третья запись в кассе.

В модели `Payment` уже есть `bepaid_uid` с уникальным индексом (Phase 1). Используем его.

## Что должно быть сделано

- Хелпер `async def find_payment_by_bepaid_uid(session, uid) -> Payment | None`
- В webhook-обработчике перед вызовом PaymentService:
  1. По `tracking_id` найти `Payment` (это наш ID).
  2. Если `payment.bepaid_uid is not None and payment.bepaid_uid != uid` → логировать warning, ответить 200 (защита от подмены)
  3. Если `payment.status == succeeded` и uid совпадает → ответ 200 без побочных эффектов («already processed»)
  4. Если `payment.status == failed` и пришёл новый webhook → переоткрытие не делаем, отвечаем 200 (защита от состояния гонки между fail и retry)
  5. В остальных случаях — сохраняем `bepaid_uid` на Payment и продолжаем обработку
- Метрика в логах: «duplicate webhook for uid X» при срабатывании защиты
- Опционально: таблица `webhook_log` (uid, received_at, payload_hash) — для аудита

## Критерии приёмки

- Тест: один и тот же payload пришёл дважды → один LedgerEntry в кассе
- Тест: webhook с `tracking_id=payment_42`, но `payment_42.bepaid_uid` уже не None и != нового uid → ответ 200, ничего не меняется, warning в логах
- Тест: payment в `succeeded`, webhook пришёл повторно → 200, без побочных эффектов
- Тест: payment в `failed`, webhook пришёл с `successful` → 200, статус НЕ меняется (защита от состояния гонки)

## Подсказки

- Уникальный индекс на `Payment.bepaid_uid` — основа. При попытке записать дубль через `INSERT/UPDATE` — `IntegrityError`. Но через `WHERE bepaid_uid IS NULL`-проверку с UPDATE избежим ошибки.
- Хеш payload (sha256(body)) полезен для логирования и аудита.

## Не делать

- Не использовать Redis или внешнюю очередь для идемпотентности — БД достаточно.
- Не делать lock'и в БД — INSERT с уникальным индексом сам по себе атомарен.
- Не возвращать 400 при дубликате — bePaid начнёт ретраить ещё активнее. Только 200.
