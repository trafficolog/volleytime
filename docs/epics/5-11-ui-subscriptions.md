---
id: '5.11'
phase: '5'
status: in_progress
sync_state: synced
last_reviewed: 2026-09-17
status_note: 'UI абонементов: список планов + покупка, мои абонементы.'
estimated_hours: '3-4'
depends_on: ['5.7']
---

# Epic 5.11: UI subscriptions (покупка, мои абонементы)

**Цель.** Игрок видит доступные планы, «покупает» абонемент (в Phase 5 — получает pending), видит свои абонементы с остатком сессий.

## Контекст

Скелет для UI-сессии. В Phase 5 покупка создаёт pending subscription (оплата — Phase 6).

## Definition of Done

- `/m/orgs/:orgId/plans` (player view) — доступные планы
- Кнопка «Получить абонемент» → создаёт subscription
- `/m/orgs/:orgId/my/subscriptions` — мои абонементы (остаток сессий, срок)

## Задачи

| ID                                            | Задача                           | Часов |
| --------------------------------------------- | -------------------------------- | ----: |
| [5.11.1](../tasks/5-11-1-plans-player.md)     | Список планов + покупка (player) |   1-2 |
| [5.11.2](../tasks/5-11-2-my-subscriptions.md) | Мои абонементы (остаток, срок)   |   1-2 |

## Не делать

- ❌ Детали — в UI-сессии
