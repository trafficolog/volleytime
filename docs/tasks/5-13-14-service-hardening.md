---
id: '5.13.14'
phase: '5'
epic: '5.13'
status: done
sync_state: synced
last_reviewed: 2026-09-16
status_note: ''
review_ref: 'Phase 5 · P2 #14'
priority: P2
roles:
  - BACK
depends_on: []
estimated_hours: '1-2'
tags:
  - subscriptions
  - bookings
  - review-fix
---

# Task 5.13.14: activate проверяет статус; listMyBookings фильтрует в SQL с пагинацией

## Цель

Убрать переактивацию exhausted/cancelled и JS-фильтрацию без лимита.

## Контекст

`activate` переактивировал exhausted/cancelled и сдвигал срок; `listMyBookings` фильтровал в JS без пагинации. (Транзакция посещаемости — 5.13.4; ZodError — 4.9.11.)

## Что должно быть сделано

1. `activate`: только `pending → active` (`UPDATE … WHERE status = 'pending'`), иначе 409 `subscription.not_pending`.
2. `listMyBookings(ctx, orgId, { filter, limit ≤ 100, offset })` — join events, условие по `starts_at` в SQL.

## Критерии приёмки

- ✅ Повторная активация → 409
- ✅ Пагинация `limit/offset` работает

## Подсказки

-

## Не делать

- ❌ Не загружать все брони пользователя
