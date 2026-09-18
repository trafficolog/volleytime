---
id: '6.8.1'
phase: '6'
epic: '6.8'
status: done
sync_state: synced
last_reviewed: 2026-09-16
status_note: ''
review_ref: 'Phase 6 · P0 #1'
priority: P0
roles:
  - BACK
  - DB
depends_on: []
estimated_hours: '2'
tags:
  - payments
  - ledger
  - concurrency
  - review-fix
---

# Task 6.8.1: Атомарное подтверждение/отклонение оплаты + уникальный доход на платёж

## Цель

Один платёж — ровно одна запись дохода при любой конкуренции.

## Контекст

`confirm` читал статус и затем обновлял без условия: 10 параллельных подтверждений → 8 доходов.

## Что должно быть сделано

1. `confirm`/`reject`: `UPDATE payments SET … WHERE id = ? AND organization_id = ? AND status = 'pending' RETURNING`; 0 строк → перечитать → `PaymentNotFoundError` / `PaymentNotPendingError` (409).
2. Миграция: `CREATE UNIQUE INDEX ledger_income_payment_uniq ON ledger_entries(payment_id) WHERE type = 'income' AND payment_id IS NOT NULL`; то же для `refund` (`category = 'refund'`).
3. Сервис принимает `orgId` (org-scope в SQL, не только в хендлере).
4. Тест: 10 параллельных confirm → 1 успех, 9 × 409, 1 доход.

## Критерии приёмки

- ✅ Тест гонки стабилен на 5 прогонах
- ✅ Повторное подтверждение → 409

## Подсказки

- Дубли данных v0.1.0 перед индексом — удалить лишние доходы по `payment_id` (оставить первый), зафиксировать в миграции.

## Не делать

- ❌ Не полагаться на проверку статуса в JS
