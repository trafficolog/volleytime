---
id: "3.2.1"
phase: 3
epic: "3.2"
status: todo
sync_state: drifted
last_reviewed: 2026-05-25
status_note: ""
roles:
  - BACK
  - WEB
depends_on: []
estimated_hours: "2-3"
tags:
  - bepaid
  - webhook
  - parsing
---

# Task 3.2.1: Парсер payload bePaid webhook

## Цель

Распарсить тело webhook'а bePaid в типизированную структуру и достать ключевые поля: `bepaid_uid`, `tracking_id`, `status`, `amount`, `transaction_type`. Дальнейшая обработка — в задачах 3.2.2 и 3.2.3.

## Контекст

В Phase 1 (Epic 1.4) `src/web/bepaid_webhook.py` уже создаёт aiohttp app, проверяет RSA-подпись и отвечает 200. Сейчас тело payload игнорируется.

Структура payload bePaid:
```json
{
  "transaction": {
    "uid": "12345-67890-abc",
    "status": "successful",
    "amount": 1500,
    "currency": "BYN",
    "tracking_id": "payment_42",
    "type": "payment",
    "payment_method_type": "credit_card",
    "created_at": "2026-05-25T10:30:00Z",
    ...
  }
}
```

`tracking_id` — это то, что мы передали в `BePaidClient.create_checkout` (формат `payment_<id>`). По нему находим наш `Payment` в БД.

## Что должно быть сделано

- Pydantic-модель `BePaidWebhookPayload` в `src/services/bepaid.py` (или отдельный `src/services/bepaid_schemas.py`):
  - `transaction.uid: str`
  - `transaction.status: Literal["successful", "failed", "error", "pending"]`
  - `transaction.amount: int` (копейки)
  - `transaction.currency: str`
  - `transaction.tracking_id: str`
  - `transaction.type: Literal["payment", "refund", ...]`
  - `transaction.payment_method_type: str | None`
- Функция `parse_webhook(body: bytes) -> BePaidWebhookPayload` (бросает `ValueError` при невалидном JSON или несоответствии схеме)
- Хелпер `extract_payment_id(tracking_id: str) -> int`: парсит `"payment_42"` → `42`. Бросает `ValueError` при невалидном формате.

## Критерии приёмки

- Тест: валидный payload разбирается без ошибок
- Тест: payload без `transaction.uid` → `ValidationError`
- Тест: `extract_payment_id("payment_42")` → `42`
- Тест: `extract_payment_id("invalid")` → `ValueError`
- Поддержаны все 4 значения `status` (включая `pending`, чтобы не падать при промежуточных уведомлениях)

## Подсказки

- Используем pydantic, который уже в зависимостях.
- `tracking_id` может быть и для абонемента (`"subscription_15"`) и для разового платежа (`"payment_42"`). Универсальный формат: `"<entity>_<id>"`. Лучше унифицировать: всегда `"payment_<id>"`, потому что `Payment` ссылается на subscription или booking сам.
- Не парсим все поля payload — только нужные нам. Pydantic с `extra="ignore"` лояльно относится к лишним.

## Не делать

- Не валидируем `amount` против `Payment.amount` здесь — это в задаче 3.2.3.
- Не делаем побочных эффектов (БД, уведомления) — только парсинг.
- Не делаем dataclass — pydantic удобнее для валидации.
