---
id: '6.8.10'
phase: '6'
epic: '6.8'
status: done
sync_state: synced
last_reviewed: 2026-09-16
status_note: ''
review_ref: 'Phase 6 · P2 #10'
priority: P2
roles:
  - QA
depends_on:
  - '6.8.1'
  - '6.8.2'
  - '6.8.6'
estimated_hours: '1-2'
tags:
  - tests
  - concurrency
  - review-fix
---

# Task 6.8.10: Тесты гонок: confirm, refund, cancel

## Цель

Денежные гонки из ревью воспроизводятся автотестами.

## Контекст

Не было ни одного конкурентного теста для денег.

## Что должно быть сделано

1. `money-races.integration.test.ts`: параллельные confirm ×10; confirm vs reject; отмена события ×5; отмена брони vs confirm.
2. Инварианты: доход ≤ 1 на платёж, возврат ≤ 1, used_sessions ∈ [0,total], сумма кассы = Σ(succeeded) − Σ(refunded).

## Критерии приёмки

- ✅ 5 прогонов без флаков

## Подсказки

-

## Не делать

-
