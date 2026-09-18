---
id: '5.13.12'
phase: '5'
epic: '5.13'
status: done
sync_state: synced
last_reviewed: 2026-09-16
status_note: ''
review_ref: 'Phase 5 · P1 #12'
priority: P1
roles:
  - BACK
depends_on:
  - '4.9.5'
estimated_hours: '2'
tags:
  - audit
  - review-fix
---

# Task 5.13.12: Audit мутаций Phase 5: события, брони, абонементы, планы, площадки

## Цель

Закрыть DoD 12 Phase 5: `select count(*) from audit_log` после сценариев > 0 по каждому типу.

## Контекст

Audit log пуст для всех мутаций Phase 5.

## Что должно быть сделано

1. Действия: `event.created/updated/cancelled`, `booking.created/cancelled/promoted/attendance_marked`, `subscription.purchased/activated/cancelled`, `plan.created/updated/archived`, `venue.created/updated/archived`.
2. Запись в той же транзакции (`auditService.record`).

## Критерии приёмки

- ✅ Интеграционный тест сценария содержит ожидаемые действия

## Подсказки

- Для броней актор — ctx.userId (игрок или организатор).

## Не делать

- ❌ Не писать ПДн в `old/newValue`
