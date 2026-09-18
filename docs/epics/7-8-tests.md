---
id: '7.8'
phase: '7'
status: todo
sync_state: drifted
last_reviewed: 2026-05-29
status_note: 'Тесты credits: spend/refund/demo/тарифы/заявки.'
estimated_hours: '3-4'
depends_on: ['7.3', '7.4', '7.5']
---

# Epic 7.8: Tests

**Цель.** Покрыть тестами credit-логику: demo grant, spend/блок при 0, refund до открытия записи, тарифный расчёт, заявка-подтверждение. Деньги → тщательность.

## Контекст

Монетизация — баги = потеря дохода/доверия. Тесты обязательны. Особое внимание: тарифный расчёт (границы порогов), refund-условие (до/после открытия записи), append-only.

## Definition of Done

- Demo grant: новая org → 5 credits
- Spend: создание Event → −1; баланс 0 → блок
- Refund: отмена до открытия записи → +1; после → нет refund
- Тарифный расчёт: границы порогов (Q=9 vs 10 vs 30 vs 100), произвольное количество
- Заявка: create → confirm → grant; reject → нет grant; повторный confirm не дублирует
- Append-only: транзакции не редактируются, баланс = SUM
- Balance инвариант: account.balance == SUM(transactions)
- ≥ 12 тестов

## Задачи

| ID    | Задача                                 | Часов |
| ----- | -------------------------------------- | ----: |
| 7.8.1 | Account/spend/refund/demo tests        |   1-2 |
| 7.8.2 | Pricing tiers + purchase request tests |   1-2 |

## Не делать

- ❌ Не делать E2E HTTP — Phase 9 паттерн
- ❌ Не дублировать Phase 5 event тесты
