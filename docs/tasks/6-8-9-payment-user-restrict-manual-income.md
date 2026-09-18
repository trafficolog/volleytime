---
id: '6.8.9'
phase: '6'
epic: '6.8'
status: done
sync_state: synced
last_reviewed: 2026-09-16
status_note: ''
review_ref: 'Phase 6 · P2 #9'
priority: P2
roles:
  - BACK
  - DB
depends_on: []
estimated_hours: '1-2'
tags:
  - payments
  - ledger
  - review-fix
---

# Task 6.8.9: payments.user_id ON DELETE RESTRICT; ручной доход в кассе

## Цель

Удаление пользователя не стирает денежную историю; организатор может внести доход вручную.

## Контекст

`payments.user_id` — CASCADE; ручного дохода нет (DoD).

## Что должно быть сделано

1. Миграция: FK `payments.user_id` → `RESTRICT` (+ rollback).
2. `ledgerService.addManualIncome` (категории `donation/sponsorship/other_income`), API `POST ledger/income`, audit.

## Критерии приёмки

- ✅ `DELETE users` с платежами → ошибка FK
- ✅ Ручной доход отображается в кассе

## Подсказки

-

## Не делать

- ❌ Не создавать платёж для ручного дохода
