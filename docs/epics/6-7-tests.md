---
id: '6.7'
phase: '6'
status: in_progress
sync_state: synced
last_reviewed: 2026-09-17
status_note: 'Тесты финансового контура. Критично: деньги.'
estimated_hours: '4-5'
depends_on: ['6.1', '6.2', '6.3', '6.4']
---

# Epic 6.7: Tests

**Цель.** Покрыть тестами финансовую логику: payment confirm/cancel/refund, ledger balance, payment integration, mass refund. Деньги требуют тщательности.

## Контекст

Финансовые баги = реальные потери/недоверие. Тесты — основная защита. Переносим сценарии из Python-прототипа (Payment.confirm как single source of truth был протестирован там).

## Definition of Done

- Payment flows: create→confirm (booking/subscription), create→cancel, succeeded→refund
- Confirm edge: booking уже не pending_payment → payment succeeded, booking не тронут
- Ledger: balance расчёт, income/expense, история фильтры
- Integration: cash booking → payment → confirm → booking confirmed + ledger income
- Integration: платный subscription → payment → confirm → subscription active
- Mass refund: событие со смешанными методами → restore + refund + cancel корректно
- Append-only инварианты: succeeded не меняется, refund отдельной записью
- Balance инвариант: balance == SUM(income) − SUM(expense) всегда
- ≥ 15 тестов

## Задачи

| ID    | Задача                                                    | Часов |
| ----- | --------------------------------------------------------- | ----: |
| 6.7.1 | Payment service tests (confirm/cancel/refund/edge)        |     2 |
| 6.7.2 | Ledger + integration tests (booking/subscription confirm) |   1-2 |
| 6.7.3 | Mass refund tests                                         |   1-2 |

## Не делать

- ❌ Не делать E2E HTTP — Phase 9
- ❌ Не делать нагрузочное — Phase 10
- ❌ Не дублировать Phase 5 booking/subscription тесты
