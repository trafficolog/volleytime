---
id: '6.2'
phase: '6'
status: in_progress
sync_state: synced
last_reviewed: 2026-09-17
status_note: 'Касса организации. Append-only, баланс через SUM.'
estimated_hours: '4-5'
depends_on: ['4.5']
---

# Epic 6.2: Ledger service (schema, entry, balance, history)

**Цель.** Модель `LedgerEntry` (income/expense с категориями) и сервис: создание записей, расчёт баланса (SUM), история с фильтрами.

## Контекст

Ledger — касса организации. Записи создаются автоматически (payment confirm → income, refund → expense) и вручную (организатор вводит расходы: аренда, инвентарь).

Решение 5: type + amount + category + nullable payment_id/event_id + description. Решение 6: enum категорий + description. Решение 7: баланс через SUM. Append-only.

## Definition of Done

- Drizzle schema `ledger_entries` (type, amount, category enum, source refs, description)
- LedgerService: createEntry, getBalance, listHistory (фильтры по type/category/дате)
- Категории: payment_income, rent, equipment, refund, salary, other
- getBalance: SUM(income) − SUM(expense)
- createEntry вызывается из paymentService (confirm→income, refund→expense) и вручную (expense)
- addExpense: ручной расход организатором (owner/organizer)
- Append-only, корректировки через новые записи

## Задачи

| ID    | Задача                                                       | Часов |
| ----- | ------------------------------------------------------------ | ----: |
| 6.2.1 | Schema ledger_entries + LedgerService (createEntry, balance) |     2 |
| 6.2.2 | History с фильтрами + addExpense                             |   1-2 |
| 6.2.3 | API endpoints (ledger GET, expense POST)                     |     1 |

## Не делать

- ❌ Не делать двойную запись (debit/credit) — простой ledger
- ❌ Не денормализовать баланс — SUM по запросу
- ❌ Не делать мультивалютность (одна валюта на org)
- ❌ Не делать налоговые расчёты — Phase 14
