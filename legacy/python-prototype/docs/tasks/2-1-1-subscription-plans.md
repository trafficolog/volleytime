---
id: "2.1.1"
phase: 2
epic: "2.1"
status: done
sync_state: aligned
last_reviewed: 2026-05-24
status_note: ""
roles:
  - BACK
  - PRODUCT
depends_on:
  - 1.2.1
estimated_hours: "0.5"
tags:
  - subscriptions
  - pricing
---

# Task 2.1.1: Планы абонементов (4x/8x/12x)

## Цель

Описать планы абонементов с ценами и сроками действия.

## Контекст

Базовые планы хранятся в коде (в Фазе 5 можно вынести в БД, если потребуется частая правка).

## Что должно быть сделано

- `SubscriptionPlan` dataclass: code, total_sessions, price, valid_days, title
- Константа `DEFAULT_PLANS` с тремя планами: 4x (56 BYN, 35 дней), 8x (104 BYN, 60 дней), 12x (144 BYN, 90 дней)
- Функция `get_plan(code)` для поиска по коду

## Критерии приёмки

- `get_plan('8x').total_sessions == 8`
- `get_plan('nope') is None`
- Все цены — `Decimal`

## Не делать

- Не хранить цены в БД
- Не вводить переменные планы (это Фаза 5)
