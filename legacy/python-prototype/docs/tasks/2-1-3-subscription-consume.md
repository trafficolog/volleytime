---
id: "2.1.3"
phase: 2
epic: "2.1"
status: done
sync_state: aligned
last_reviewed: 2026-05-24
status_note: ""
roles:
  - BACK
depends_on:
  - 2.1.2
estimated_hours: "2-3"
tags:
  - subscriptions
  - concurrency
---

# Task 2.1.3: Атомарное списание сессии

## Цель

Реализовать атомарное списание сессии абонемента, защищённое от гонок.

## Контекст

Без атомарности два параллельных запроса могут списать одну сессию дважды (например, при двойном клике пользователя).

## Что должно быть сделано

- `SubscriptionService.consume_session(sub_id)` через SQL `UPDATE ... WHERE used_sessions < total_sessions`
- Если rowcount = 0 → `SubscriptionDepletedError`
- Проверка `expires_at > now()` перед списанием → `SubscriptionExpiredError`
- Авто-перевод в `depleted` при `used == total`

## Критерии приёмки

- Списание из 3-сессионного абонемента 3 раза → status `depleted`
- 4-е списание → `SubscriptionDepletedError`
- Истёкший абонемент → `SubscriptionExpiredError`
- Параллельные запросы не списывают одну сессию дважды (тест с asyncio.gather)

## Не делать

- Не использовать оптимистическую блокировку через `version` — UPDATE-условия достаточно
- Не загружать абонемент → проверять в Python → сохранять (race condition)
