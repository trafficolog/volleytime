---
id: "3.1.1"
phase: 3
epic: "3.1"
status: todo
sync_state: drifted
last_reviewed: 2026-05-25
status_note: ""
roles:
  - BACK
depends_on: []
estimated_hours: "3-4"
tags:
  - bepaid
  - http-client
  - integration
---

# Task 3.1.1: BePaidClient — Basic Auth + создание checkout

## Цель

Реализовать HTTP-клиент для bePaid с методом `create_checkout(amount, tracking_id, description, payment_methods, return_url)`. Возвращает `(token, redirect_url)`. Поддерживает тестовый режим и ретраи на сетевые ошибки.

## Контекст

Базовый строительный блок Phase 3. Все исходящие запросы к bePaid идут через этот класс. Используется в Epic 3.3 (UX оплаты) и Epic 3.1.2 (refund — отдельная задача, переиспользует тот же session).

bePaid API:
- Endpoint: `POST https://checkout.bepaid.by/ctp/api/checkouts`
- Auth: HTTP Basic, `base64(SHOP_ID:SECRET_KEY)` в заголовке `Authorization`
- Content-Type: `application/json`
- Сумма в копейках (15.00 BYN → 1500)

## Что должно быть сделано

- Класс `BePaidClient` в `src/services/bepaid.py`
- Конструктор принимает `shop_id`, `secret_key`, `base_url`, `test_mode` из settings
- aiohttp.ClientSession создаётся в `__aenter__` / закрывается в `__aexit__`
- Метод `async def create_checkout(...)`:
  - параметры: `amount: Decimal`, `tracking_id: str`, `description: str`, `payment_methods: list[str]` (например `["credit_card", "erip"]`), `return_url: str`, `notification_url: str`, `customer_email: str | None`
  - формирует payload по схеме bePaid
  - конвертирует `Decimal` → копейки через `int(amount * 100)`
  - если `test_mode=True`, добавляет `"test": true`
  - делает POST, парсит ответ
  - возвращает `CheckoutResult(token: str, redirect_url: str)` (dataclass)
- Retry: 3 попытки с экспоненциальным backoff (1, 2, 4 сек) на `ClientConnectorError`, `ServerTimeoutError`, 5xx
- 4xx — не ретраить, бросать `BePaidClientError(status, body)`
- Тайм-аут на запрос — 10 сек
- Логирование: запрос (без Authorization), ответ (без полного body, только status и tracking_id)
- Импорты лениво — чтобы при отсутствии `BEPAID_SHOP_ID` в `.env` бот всё ещё стартовал (для Phase 2-режима)

## Критерии приёмки

- Юнит-тест с моком aiohttp: `create_checkout` возвращает корректный `CheckoutResult` при 200
- Тест: при 401 → `BePaidClientError(401, ...)`
- Тест: при сетевой ошибке делает 3 попытки
- Тест: payload содержит `"test": true` при `test_mode=True`
- В логах нет `Authorization: Basic ...`
- При отсутствии `BEPAID_SHOP_ID` в `.env` — `BePaidClient.__init__` бросает понятную ошибку с подсказкой

## Подсказки

- См. `docs/BEPAID.md` — пример полного payload.
- HTTP Basic: `aiohttp.BasicAuth(shop_id, secret_key)` в `session.post(..., auth=...)`.
- Для ретраев можно `aiohttp_retry` или вручную через `for attempt in range(3): try: ... except: await asyncio.sleep(2**attempt)`.
- `Decimal * 100` может дать `Decimal('1500.00')` — нужен `int()`.

## Не делать

- Не пишем парсер ответа: возвращаем `CheckoutResult` с двумя полями (token, redirect_url), всё остальное игнорируем.
- Не делаем circuit breaker / health check.
- Не вызываем bePaid из сервиса напрямую при импорте модуля — лениво.
