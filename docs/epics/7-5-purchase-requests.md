---
id: '7.5'
phase: '7'
status: todo
sync_state: drifted
last_reviewed: 2026-05-29
status_note: 'Заявка на покупку → подтверждение root-админом → grant credits.'
estimated_hours: '3-4'
depends_on: ['7.1', '7.4']
---

# Epic 7.5: Заявки на покупку + подтверждение

**Цель.** Организатор создаёт заявку на покупку (количество + расчётная сумма). Root-admin получает уведомление, согласует оплату, подтверждает → credits начислены (purchase transaction). Или отклоняет.

## Контекст

Решение 5: ручное подтверждение в Phase 7 (online-оплата — Phase 12). Заявка фиксирует намерение, root-admin подтверждает после получения оплаты (перевод). В бете объёмы малы — ручное ОК.

## Definition of Done

- credit_purchase_requests (организация, количество, сумма, статус: pending/confirmed/rejected)
- Организатор создаёт заявку (количество → сумма по сетке 7.4)
- Уведомление root-админу (новая заявка) — через notifier/служебный канал
- Root-admin подтверждает → grant credits (purchase transaction) + request confirmed
- Root-admin отклоняет → request rejected (с причиной опц)
- Покупка в EventCreditTransaction (количество + сумма, type=purchase)
- Идемпотентность (повторное подтверждение не дублирует)

## Задачи

| ID    | Задача                                                     | Часов |
| ----- | ---------------------------------------------------------- | ----: |
| 7.5.1 | PurchaseRequest schema + service (create, confirm, reject) |     2 |
| 7.5.2 | Уведомление root-админу + API endpoints                    |   1-2 |

## Не делать

- ❌ Не делать online-оплату (Phase 12)
- ❌ Не начислять credits до подтверждения
- ❌ Не дублировать при повторном confirm
- ❌ Не вести платформенный ledger (только transaction)
