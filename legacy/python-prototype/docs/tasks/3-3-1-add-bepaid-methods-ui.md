---
id: "3.3.1"
phase: 3
epic: "3.3"
status: todo
sync_state: drifted
last_reviewed: 2026-05-25
status_note: ""
roles:
  - BOT
depends_on:
  - "3.1.1"
estimated_hours: "1-2"
tags:
  - ux
  - keyboards
---

# Task 3.3.1: Кнопки bepaid_card / bepaid_erip в payment_method_choice

## Цель

Добавить в существующие клавиатуры `payment_method_choice` (для записи на тренировку) и `subscription_payment_method` (для покупки абонемента) кнопки «💳 Оплатить картой» и «🏦 Оплатить через ЕРИП», в зависимости от настроек.

## Контекст

В Phase 2 в `src/bot/keyboards.py` уже есть закомментированная строка:
```python
# kb.button(text="💳 Картой / ЕРИП", callback_data=f"booking:pay:bepaid:{training_id}")
```

Phase 3 раскомментирует её, разделит на две кнопки, добавит проверку настроек.

## Что должно быть сделано

- В `payment_method_choice(training_id, has_subscription, remaining)` добавить параметры `bepaid_card_enabled: bool`, `bepaid_erip_enabled: bool`
- Если включены — показать соответствующие кнопки с callback_data `booking:pay:bepaid:card:<training_id>` и `booking:pay:bepaid:erip:<training_id>`
- Та же логика в `subscription_payment_method(plan_code, bepaid_card_enabled, bepaid_erip_enabled)`: кнопки `sub:pay:bepaid:card:<plan_code>` и `sub:pay:bepaid:erip:<plan_code>`
- Источник флагов: `settings.bepaid_card_enabled`, `settings.bepaid_erip_enabled` (новые поля в Settings)
- Если выключено всё кроме cash — UI работает как в Phase 2 (обратная совместимость)

## Критерии приёмки

- Юнит-тест клавиатуры: при `bepaid_card_enabled=True` есть кнопка с текстом «💳 Оплатить картой»
- Юнит-тест: при `bepaid_card_enabled=False` кнопки нет
- При выключенном bePaid поведение полностью совпадает с Phase 2

## Подсказки

- Используем `InlineKeyboardBuilder`, как в существующем коде.
- Порядок кнопок: с абонемента (если есть) → ЕРИП → картой → наличными → отмена. Самые удобные сверху.
- Делать в одну строку или в несколько — на усмотрение, но `.adjust(1)` — стандарт.

## Не делать

- Не реализовываем сам хендлер `booking:pay:bepaid:...` — это задача 3.3.2.
- Не показываем дополнительный текст про комиссии в кнопке — иначе она будет огромной. Можно в подсказке тренировки.
