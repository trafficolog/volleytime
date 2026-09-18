---
id: "3.1.2"
phase: 3
epic: "3.1"
status: todo
sync_state: drifted
last_reviewed: 2026-05-25
status_note: ""
roles:
  - BACK
depends_on:
  - "3.1.1"
estimated_hours: "1-2"
tags:
  - bepaid
  - refund
---

# Task 3.1.2: BePaidClient — refund

## Цель

Добавить в `BePaidClient` метод `refund(bepaid_uid, amount, reason)`, который инициирует возврат по исходному платежу через bePaid API.

## Контекст

Refund используется в двух местах:
- При отмене тренировки админом (Epic 2.6.4 + апдейт под Phase 3): если оплата была картой, нужно вернуть деньги.
- При возврате абонемента по запросу игрока (Phase 5, опционально).

API bePaid:
- Endpoint: `POST https://api.bepaid.by/transactions/{parent_uid}/refunds`
- Auth: тот же Basic
- Body: `{"request": {"amount": <копейки>, "reason": "<строка>"}}`
- Возвращает новый transaction с status `successful` / `failed`

## Что должно быть сделано

- Метод `async def refund(parent_uid: str, amount: Decimal, reason: str) -> RefundResult`
- `RefundResult` (dataclass): `uid: str`, `status: str` (`successful` / `failed`), `parent_uid: str`
- Использует тот же aiohttp.ClientSession, что и create_checkout
- Retry с экспоненциальным backoff, как в 3.1.1
- На 4xx → `BePaidClientError`
- Обновление существующего хендлера отмены тренировки (Epic 2.6.4) — TODO в Phase 3:
  - Для платежей с `method == bepaid_card` или `bepaid_erip` и `status == succeeded` — вызвать `bepaid.refund(payment.bepaid_uid, payment.amount, "Training cancelled by admin")`
  - При успехе — `Payment.status = refunded`, в кассу `LedgerEntry(expense, category=refund)`
  - При неудаче — логировать, оставить статус `succeeded`, уведомить админа: «авто-refund не прошёл, нужно вернуть вручную»

## Критерии приёмки

- Тест: успешный refund возвращает `RefundResult(status="successful", ...)`
- Тест: при `parent_uid` не существует → `BePaidClientError(404, ...)`
- Интеграция с `cancel_training` (Epic 2.6.4) — в карточке тренировки кнопка «Отменить» теперь делает refund для bepaid-платежей
- Если refund провалился — в админ-меню появляется пометка «требует ручного возврата»

## Подсказки

- `bepaid_uid` — это UID из исходного успешного webhook (хранится в `Payment.bepaid_uid`).
- Возврат частичный — указываем `amount` явно. Полный возврат = вся сумма платежа.
- В реальной bePaid могут быть рассогласования по `parent_uid` (для теста использовать sandbox).

## Не делать

- Не делать частичные refund'ы из UI (только полный за тренировку).
- Не создавать новый `Payment` для refund — обновляем существующий + пишем `LedgerEntry(expense)`.
- Не зависим от Phase 3 webhook'а — refund инициируется нами, а не приходит как уведомление.
