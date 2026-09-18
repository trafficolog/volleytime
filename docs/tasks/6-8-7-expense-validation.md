---
id: '6.8.7'
phase: '6'
epic: '6.8'
status: done
sync_state: synced
last_reviewed: 2026-09-16
status_note: ''
review_ref: 'Phase 6 · P1 #7'
priority: P1
roles:
  - BACK
  - SECURITY
depends_on: []
estimated_hours: '1'
tags:
  - ledger
  - validation
  - review-fix
---

# Task 6.8.7: Расход: zod-валидация суммы, категории, даты, события своей организации

## Цель

Касса не принимает дробные/отрицательные суммы, произвольные категории и чужие события.

## Контекст

`addExpense` принимал `amount: 1.5`, `-100`, любую категорию; хендлер не валидировал.

## Что должно быть сделано

1. `AddExpenseInput`: `amount` int > 0 ≤ 10 000 000, `category` enum (rent/equipment/salary/other), `description` ≤ 500, `occurredAt` дата (не будущее > 1 дня), `eventId` своей организации.
2. Хендлер через `defineApiHandler` + parse; миграция `ledger_entries.occurred_at` (если нет).

## Критерии приёмки

- ✅ `1.5`, `-100`, `category: hack`, чужой eventId → 422/404

## Подсказки

-

## Не делать

- ❌ Не хранить суммы во float
