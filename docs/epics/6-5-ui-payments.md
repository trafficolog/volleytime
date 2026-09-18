---
id: '6.5'
phase: '6'
status: in_progress
sync_state: synced
last_reviewed: 2026-09-17
status_note: 'UI admin: список pending-платежей, подтверждение/отклонение.'
estimated_hours: '3-4'
depends_on: ['6.1', '6.3']
---

# Epic 6.5: UI admin — pending payments + confirm/reject

**Цель.** Mini App страница для организатора: список ожидающих подтверждения платежей, подтверждение/отклонение одним действием.

## Контекст

Организатор принимает наличные/перевод на месте, затем подтверждает в приложении. UI переиспользует паттерны Phase 5 (composables, labels, sheets).

## Definition of Done

- `/m/orgs/:orgId/payments` — список pending платежей (игрок, событие/абонемент, сумма, метод)
- Подтвердить → confirm (booking confirmed / subscription active)
- Отклонить → cancel (booking cancelled) с confirm-диалогом
- Группировка: за событие / за абонемент
- Статусы и методы на русском (через labels.ts)
- Empty state, loading
- Только owner/organizer

## Задачи

| ID    | Задача                                           | Часов |
| ----- | ------------------------------------------------ | ----: |
| 6.5.1 | usePayments composable + список pending          |   1-2 |
| 6.5.2 | Confirm/reject действия + интеграция в dashboard |   1-2 |

## Не делать

- ❌ Не делать историю всех платежей (только pending) — история в кассе (6.6)
- ❌ Не делать online — Phase 12
- ❌ Не делать bulk confirm — по одному
