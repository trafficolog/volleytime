---
id: '5.13.6'
phase: '5'
epic: '5.13'
status: done
sync_state: synced
last_reviewed: 2026-09-16
status_note: ''
review_ref: 'Phase 5 · P1 #6'
priority: P1
roles:
  - BACK
depends_on:
  - '5.13.5'
estimated_hours: '2'
tags:
  - bookings
  - waitlist
  - subscriptions
  - review-fix
---

# Task 5.13.6: Промоушен из листа ожидания с method=subscription списывает сессию

## Цель

Игрок, продвинутый из листа ожидания, не получает место бесплатно.

## Контекст

Waitlist → отмена первого → `confirmed`, `used_sessions = 0`, `subscription_id = null`.

## Что должно быть сделано

1. `promoteFromWaitlist`: для `method = subscription` — `consumeSession(userId, orgId, next.subscriptionId)`; успех → `confirmed` + `subscription_id`; нет активного абонемента → `pending_payment` с method `cash` и pending-платежом (игрок уведомляется «оплатите участие»).
2. При записи в лист ожидания с абонемента запоминать выбранный `subscription_id` (без списания).
3. Выбор следующего — `FOR UPDATE SKIP LOCKED` (см. 5.13.7).

## Критерии приёмки

- ✅ Промоушен с абонементом: `used_sessions` +1, `subscription_id` заполнен
- ✅ Абонемент закончился → pending_payment + платёж

## Подсказки

- Phase 15 заменит слепой промоушен на confirm-flow.

## Не делать

- ❌ Не подтверждать место без списания или платежа
