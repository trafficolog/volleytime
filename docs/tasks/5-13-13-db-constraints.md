---
id: '5.13.13'
phase: '5'
epic: '5.13'
status: done
sync_state: synced
last_reviewed: 2026-09-16
status_note: ''
review_ref: 'Phase 5 · P2 #13'
priority: P2
roles:
  - DB
depends_on: []
estimated_hours: '1-2'
tags:
  - migrations
  - integrity
  - review-fix
---

# Task 5.13.13: CHECK и FK на уровне БД для денег и слотов

## Цель

Вторая линия защиты: БД не принимает отрицательные цены, переполненные абонементы и висячие ссылки.

## Контекст

Нет ни одного CHECK; у `bookings.subscription_id`/`payment_id` нет FK.

## Что должно быть сделано

1. CHECK: `events.capacity > 0`, `events.price >= 0`, `events.ends_at > starts_at`, `subscriptions.used_sessions BETWEEN 0 AND total_sessions`, `subscription_plans.total_sessions > 0`, `price >= 0`, `payments.amount > 0`, `ledger_entries.amount > 0`.
2. FK `bookings.subscription_id → subscriptions ON DELETE SET NULL`, `bookings.payment_id → payments ON DELETE SET NULL`.
3. Чистка нарушений перед добавлением; rollback-скрипт.

## Критерии приёмки

- ✅ `UPDATE subscriptions SET used_sessions = total_sessions + 1` отвергается
- ✅ Миграция применяется на данных v0.1.0

## Подсказки

- Цикл bookings ↔ payments в Drizzle — FK через `foreignKey()` в третьем аргументе таблицы.

## Не делать

- ❌ Не использовать CASCADE для денежных связей
