---
id: "2.4.1"
phase: 2
epic: "2.4"
status: done
sync_state: aligned
last_reviewed: 2026-05-24
status_note: ""
roles:
  - BACK
depends_on:
  - 1.2.1
estimated_hours: "2-3"
tags:
  - ledger
  - money
---

# Task 2.4.1: LedgerService: income/expense/balance

## Цель

Реализовать LedgerService: income, expense, balance, история.

## Контекст

Касса должна давать чёткую картину «сколько собрали, потратили, осталось» в любой момент. Это основа для отчётности перед группой и для деклараций.

## Что должно быть сделано

- `LedgerService.record_income(amount, category, ...)` → LedgerEntry
- `LedgerService.record_expense(...)` с поддержкой `evidence_file_id`
- `LedgerService.record_income_from_payment(payment)` — хелпер
- `LedgerService.get_balance(until=date)` → LedgerBalance(income, expense, balance)
- `LedgerService.list_recent(limit)` для UI

## Критерии приёмки

- После confirm Payment появляется LedgerEntry(income)
- balance = income - expense
- Все суммы — Decimal с округлением до копеек
- При повторном confirm — не дублируется (см. 2.4.3)

## Не делать

- Не пересчитывать баланс из payments каждый раз — только из LedgerEntry
- Не удалять записи, только добавлять
