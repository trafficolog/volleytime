---
id: "2.11.1"
phase: "2.5"
epic: "2.11"
status: todo
sync_state: drifted
last_reviewed: 2026-05-25
status_note: ""
roles:
  - BOT
  - BACK
depends_on:
  - "2.8.2"
estimated_hours: "2"
tags:
  - admin
  - subscriptions
  - manual
---

# Task 2.11.1: Создание абонемента вручную (подарок)

## Цель

Из карточки игрока (Task 2.8.2) кнопка «🎫 Создать абонемент»: выбор плана + опция «подарок (amount=0, без записи в кассу)» или «обычная покупка (cash, succeeded)».

## Контекст

Сценарии: подарок за помощь, компенсация за сорванную тренировку, тестовый абонемент для нового игрока.

## Что должно быть сделано

- Кнопка «🎫 Создать абонемент» в карточке игрока
- FSM `ManualCreateSubscription`:
  1. `waiting_plan` — inline-клавиатура с активными планами
  2. `waiting_payment_mode`:
     - «🎁 Подарок (без оплаты)» — `Payment.amount=0`, `status=succeeded`, без ledger
     - «💵 Оплачено наличными» — `Payment.amount=plan.price`, `status=succeeded`, **с** записью income в ledger
     - «📝 Без записи в кассу» — `Payment.amount=plan.price`, `status=succeeded`, но без ledger (для случая когда оплата прошла мимо)
  3. (опционально) `waiting_note` — комментарий для AdminLog
- Создание Subscription:
  - `status=active`, `purchased_at=now()`, `expires_at=now()+plan.valid_days`
  - `used_sessions=0`, `total_sessions=plan.total_sessions`
  - `price=Payment.amount` (зафиксированная цена)
- Уведомление игроку:
  - Подарок: «🎁 Вам подарили абонемент на N тренировок! Срок действия до DD.MM»
  - Оплачен: «Ваш абонемент активирован: N тренировок, до DD.MM»
- AdminLog (action="manual_subscription_create", details={plan_code, mode, amount, note})

## Критерии приёмки

- Подарок создаётся без записи в кассу (баланс не меняется)
- При выборе «оплачено наличными» — LedgerEntry(income, category=subscription) создаётся
- Игрок получает уведомление
- Subscription в активном состоянии, готов к использованию

## Подсказки

- Переиспользуем `SubscriptionService.create_pending` + сразу `confirm`, либо новый метод `create_active`.
- Если выбран подарок, формулировка в Subscription.description — «Gift by admin <name>».

## Не делать

- Не создавать абонементы с отрицательной ценой.
- Не привязывать к будущим тренировкам — абонемент глобальный.
- Не запрашивать у игрока подтверждение «принимаете подарок?» — это лишний шаг.
