---
id: '5.13.10'
phase: '5'
epic: '5.13'
status: done
sync_state: synced
last_reviewed: 2026-09-16
status_note: ''
review_ref: 'Phase 5 · P1 #10'
priority: P1
roles:
  - BACK
depends_on: []
estimated_hours: '1'
tags:
  - bookings
  - review-fix
---

# Task 5.13.10: Запрет отмены attended/no_show и после старта события

## Цель

Отметка посещения необратима через отмену; сессия не возвращается.

## Контекст

`attended` → отмена игроком → 200, used 3 → 2.

## Что должно быть сделано

1. `cancel`: `attended|no_show` → 409 `booking.not_cancellable`; событие уже началось → 409 для игрока и для организатора (организатор правит посещаемость, а не отменяет).
2. Тесты.

## Критерии приёмки

- ✅ Отмена attended → 409, used не меняется
- ✅ Отмена после старта → 409

## Подсказки

- Для исправлений посещаемости — повторная отметка (5.13.4).

## Не делать

- ❌ Не удалять брони
