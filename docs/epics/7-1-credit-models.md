---
id: '7.1'
phase: '7'
status: todo
sync_state: drifted
last_reviewed: 2026-05-29
status_note: 'EventCreditAccount + EventCreditTransaction. Append-only журнал.'
estimated_hours: '3-4'
depends_on: ['4.1']
---

# Epic 7.1: Credit account + transaction модели

**Цель.** Модели баланса credits организации (EventCreditAccount) и журнала движений (EventCreditTransaction, append-only). Сервис: баланс, движения.

## Контекст

Основа монетизации. Account хранит баланс (или вычисляется по транзакциям), Transaction — каждое движение (grant/spend/refund/purchase). Append-only как Payment/Ledger (Phase 6).

## Definition of Done

- EventCreditAccount (организация → баланс)
- EventCreditTransaction (тип, количество ±, причина, ссылки, баланс после)
- Типы транзакций: demo_grant, admin_grant, purchase, spend, refund
- Баланс: вычисляется по транзакциям (SUM) или денормализован + сверка
- Сервис: getBalance, addTransaction (атомарно меняет баланс)
- Append-only (транзакции не редактируются)

## Задачи

| ID    | Задача                                  | Часов |
| ----- | --------------------------------------- | ----: |
| 7.1.1 | Schema account + transaction + миграция |   1-2 |
| 7.1.2 | CreditService (balance, addTransaction) |   1-2 |

## Не делать

- ❌ Не редактировать транзакции (append-only)
- ❌ Не допускать рассинхрон баланса и журнала
- ❌ Не делать UI — эпик 7.6
