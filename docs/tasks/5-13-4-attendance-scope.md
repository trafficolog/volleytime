---
id: '5.13.4'
phase: '5'
epic: '5.13'
status: done
sync_state: synced
last_reviewed: 2026-09-16
status_note: ''
review_ref: 'Phase 5 · P0 #4 (+ P2 #14 транзакция)'
priority: P0
roles:
  - BACK
  - SECURITY
depends_on: []
estimated_hours: '1-2'
tags:
  - bookings
  - attendance
  - security
  - review-fix
---

# Task 5.13.4: Посещаемость: только брони этого события этой организации, в транзакции

## Цель

Организатор B не может отметить посещаемость брони организации A.

## Контекст

`bulkAttendance` принимал любые `bookingId`: владелец B через свой URL поставил `no_show` брони A → 200.

## Что должно быть сделано

1. `bulkAttendance(ctx, orgId, eventId, marks)` в транзакции: zod `marks: {bookingId:int, attended:boolean}[] (1..500)`; одним запросом выбрать брони `id IN (...) AND event_id = ? AND organization_id = ?`; любые лишние id → 404 и откат.
2. Отметка только для `confirmed|attended|no_show`, событие уже началось (или `closed`/`finished`).
3. Audit `booking.attendance_marked`.

## Критерии приёмки

- ✅ Чужая бронь в пачке → 404, ни одна отметка не применена
- ✅ Отметка до начала события → 422

## Подсказки

- Батч-UPDATE по `CASE`, либо цикл внутри одной tx.

## Не делать

- ❌ Не отмечать по одному без транзакции
