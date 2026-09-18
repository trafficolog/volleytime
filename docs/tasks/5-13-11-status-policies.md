---
id: '5.13.11'
phase: '5'
epic: '5.13'
status: done
sync_state: synced
last_reviewed: 2026-09-16
status_note: ''
review_ref: 'Phase 5 · P1 #11'
priority: P1
roles:
  - BACK
  - SECURITY
depends_on:
  - '4.9.7'
estimated_hours: '2'
tags:
  - events
  - bookings
  - review-fix
---

# Task 5.13.11: Политики: pending не записывается, черновики скрыты, capacity ≥ занятых, события только в будущем

## Цель

Закрыть 4 обхода бизнес-правил, подтверждённых через API.

## Контекст

Pending-участник записывался (confirmed); черновики видны игрокам; capacity уменьшалась ниже занятых; события создавались в прошлом.

## Что должно быть сделано

1. `book`: только `active` участник (`booking.member_not_active`).
2. `eventService.list/getById`: для не-управляющих — без `draft` (getById → 404).
3. `update`: `capacity < taken` → 422 `event.capacity_below_taken`.
4. `create`: `startsAt > now` (422 `event.starts_in_past`); `update` времени — тоже в будущее, если событие ещё не началось.

## Критерии приёмки

- ✅ Все 4 сценария из ревью → 4xx с кодами

## Подсказки

- Флаг `includeDrafts` передаётся из хендлера по `canManageContent`.

## Не делать

- ❌ Не проверять только в UI
