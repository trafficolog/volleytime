---
id: "3.3"
phase: 3
status: todo
sync_state: drifted
last_reviewed: 2026-05-25
status_note: "UX-обвязка вокруг bePaid: кнопки, deeplink, обработка возврата пользователя."
---

# Epic 3.3: UX оплаты

**Цель.** Добавить в существующий FSM записи и покупки абонемента опции «Оплатить картой» и «ЕРИП». Пользователь жмёт → получает кнопку с deeplink на bePaid → оплачивает → возвращается в бот по `return_url` (или просто закрывает страницу — webhook всё равно подтвердит).

## Контекст

В Phase 2 в `payment_method_choice()` (keyboards.py) уже есть закомментированная кнопка `bepaid_card`. Phase 3 раскомментирует её, добавит хендлер, и реализует короткий цикл: создать Payment в `pending` → дёрнуть BePaidClient.create_checkout → отправить пользователю кнопку с URL.

## Definition of Done

- В `payment_method_choice` появились две новые кнопки: «💳 Оплатить картой» и «ЕРИП» (только если оба метода активны в config)
- Та же логика в `subscription_payment_method`
- Хендлер `booking:pay:bepaid:card:<training_id>`:
  - проверяет propose_slot
  - создаёт Booking в `pending_payment`
  - создаёт Payment в `pending` с method=bepaid_card
  - вызывает BePaidClient.create_checkout → получает `redirect_url`
  - сохраняет `payment.bepaid_token`
  - отправляет пользователю сообщение с inline-кнопкой «Перейти к оплате»
- Аналогичный хендлер для абонементов
- Если bePaid недоступен (ошибка API) — fallback: показать «Сервис временно недоступен, выберите наличные»
- Уведомление через TTL (Phase 4): «оплата не пришла за 15 минут — бронь снята»

## Задачи

| ID | Задача | Статус |
|----|--------|--------|
| [3.3.1](../tasks/3-3-1-add-bepaid-methods-ui.md) | Методы bepaid_card / bepaid_erip в UI | todo |
| [3.3.2](../tasks/3-3-2-checkout-deeplink.md) | Deeplink на checkout + сохранение токена | todo |
| [3.3.3](../tasks/3-3-3-erip-qr-code.md) | QR-код для ЕРИП | todo |

## Не делать

- **Не делаем свой UI оплаты.** Только hosted page bePaid.
- **Не сохраняем PAN, CVV, expiry.** Никогда.
- **Не подтверждаем Booking до webhook'а.** Booking остаётся в `pending_payment` до прихода успешного webhook.
- **Не показываем игроку статус оплаты в реальном времени** через polling bePaid API. Webhook → push-уведомление пользователю. Если хочется кнопки «Проверить оплату» — это Phase 5 (опционально).
