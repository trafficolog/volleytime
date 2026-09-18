---
id: '5.13.2'
phase: '5'
epic: '5.13'
status: done
sync_state: synced
last_reviewed: 2026-09-16
status_note: ''
review_ref: 'Phase 5 · P0 #2'
priority: P0
roles:
  - BACK
depends_on: []
estimated_hours: '1'
tags:
  - bookings
  - api
  - review-fix
---

# Task 5.13.2: Список броней события не падает на BigInt: выборка только нужных полей

## Цель

Организатор видит состав события.

## Контекст

`with: { user: true }` тянул `telegram_user_id` (bigint) → 500 «Do not know how to serialize a BigInt».

## Что должно быть сделано

1. `bookingService.listByEvent` — select с join users: `{ id, status, method, bookedAt, confirmedAt, subscriptionId, paymentId, user: { id, name, telegramUsername, image } }`.
2. Сортировка: confirmed/pending_payment по bookedAt, затем waitlisted, затем прочие.

## Критерии приёмки

- ✅ `GET events/:id/bookings` своей организации → 200 с составом

## Подсказки

- Тот же формат пользователя, что в 4.9.13.

## Не делать

- ❌ Не добавлять BigInt.prototype.toJSON глобально
