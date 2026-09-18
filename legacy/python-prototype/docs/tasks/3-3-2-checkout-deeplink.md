---
id: "3.3.2"
phase: 3
epic: "3.3"
status: todo
sync_state: drifted
last_reviewed: 2026-05-25
status_note: ""
roles:
  - BOT
  - BACK
depends_on:
  - "3.1.1"
  - "3.3.1"
estimated_hours: "2-3"
tags:
  - bepaid
  - ux
  - deeplink
---

# Task 3.3.2: Deeplink на checkout + сохранение токена

## Цель

Реализовать хендлеры `booking:pay:bepaid:card:*`, `booking:pay:bepaid:erip:*`, `sub:pay:bepaid:card:*`, `sub:pay:bepaid:erip:*`. Логика: создать Payment в `pending`, вызвать `BePaidClient.create_checkout`, сохранить токен, показать пользователю кнопку с `redirect_url`.

## Контекст

Связывает UX (Epic 3.3) и сервис (Epic 3.1). До webhook (Epic 3.2) бот не знает результата — кнопка просто увозит пользователя в bePaid.

## Что должно быть сделано

- Хендлер `booking:pay:bepaid:card:<training_id>`:
  1. `propose_slot` через `BookingService` (проверка доступности).
  2. Создать `Booking` в `pending_payment`.
  3. Создать `Payment` в `pending`, `method=bepaid_card`.
  4. Связать `booking.payment_id = payment.id`.
  5. Вызвать `BePaidClient.create_checkout(amount=payment.amount, tracking_id=f"payment_{payment.id}", description=f"Тренировка {format_dt_human(training.starts_at)}", payment_methods=["credit_card"], return_url=settings.bot_deeplink, notification_url=settings.public_url + "/webhooks/bepaid", customer_email=...)`.
  6. Сохранить `payment.bepaid_token = result.token`, commit.
  7. Отправить сообщение пользователю с inline-кнопкой URL: «💳 Перейти к оплате» (link button, не callback).
  8. Сообщить, что после оплаты бот пришлёт подтверждение автоматически.
- Аналогичный хендлер для ЕРИП (`payment_methods=["erip"]`).
- Аналогичный хендлер для покупки абонемента (`booking_id=None`, `subscription_id=sub.id`).
- При ошибке `BePaidClientError` — fallback: откатить booking, показать сообщение «Сервис временно недоступен, попробуйте позже или оплатите наличными».

## Критерии приёмки

- Хендлеры существуют и зарегистрированы в `player_router`
- При нажатии «Оплатить картой» создаётся Payment в `pending` и отправляется кнопка с URL
- Кнопка — это `InlineKeyboardButton(text=..., url=redirect_url)`, а не callback
- При ошибке bePaid пользователь видит понятное сообщение, бронь отменена
- В логах — `event="bepaid_checkout_created"` с payment_id, без чувствительных данных

## Подсказки

- `return_url`: для Telegram-бота удобно использовать `https://t.me/<bot_username>` — пользователь вернётся в чат.
- `notification_url`: должен быть HTTPS-публичным. В dev можно `ngrok http 8080` для тестов.
- TTL пэйменту: хорошо иметь `payment.expires_at`. Можно поставить = `now() + 20 минут`. TTL-обработчик пишется в Phase 4 (Task 4.3.1).

## Не делать

- Не использовать `bot.send_invoice` — это для встроенной оплаты Telegram, у нас своя через bePaid.
- Не подтверждать платёж сразу — ждём webhook.
- Не отправлять пользователю QR-код в этом таске (это 3.3.3).
