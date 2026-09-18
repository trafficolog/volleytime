---
id: '5.13.3'
phase: '5'
epic: '5.13'
status: done
sync_state: synced
last_reviewed: 2026-09-16
status_note: ''
review_ref: 'Phase 5 · P0 #3'
priority: P0
roles:
  - BACK
  - SECURITY
depends_on:
  - '5.13.2'
estimated_hours: '1'
tags:
  - bookings
  - tenant
  - security
  - review-fix
---

# Task 5.13.3: Список броней события: проверка организации события и whitelist полей

## Цель

Нельзя получить состав события чужой организации; персональные данные не утекают.

## Контекст

Хендлер не сверял `event.organizationId`; после починки BigInt утекли бы email, телефон, telegram id, `is_root_admin`.

## Что должно быть сделано

1. `listByEvent(ctx, orgId, eventId)`: `WHERE bookings.event_id = ? AND bookings.organization_id = ?`; событие другой организации → `EventNotFoundError` (404).
2. API-тест: владелец B запрашивает бронь события A → 404; в ответе своей организации нет `email|phone|telegramUserId|isRootAdmin`.

## Критерии приёмки

- ✅ Чужое событие → 404
- ✅ JSON ответа не содержит приватных полей

## Подсказки

- Проверка на уровне SQL, не только в хендлере.

## Не делать

- ❌ Не отдавать строку `users` целиком
