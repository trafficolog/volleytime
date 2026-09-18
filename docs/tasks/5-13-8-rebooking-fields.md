---
id: '5.13.8'
phase: '5'
epic: '5.13'
status: done
sync_state: synced
last_reviewed: 2026-09-16
status_note: ''
review_ref: 'Phase 5 · P1 #8'
priority: P1
roles:
  - BACK
depends_on: []
estimated_hours: '1'
tags:
  - bookings
  - review-fix
---

# Task 5.13.8: Повторная запись: реактивация обновляет subscription_id и payment_id

## Цель

cash → отмена → запись с абонемента: сессия списана и вернётся при отмене.

## Контекст

Реактивация не трогала `subscription_id`/`payment_id`: `sub=null`, `pay` от старой брони; отмена не вернула сессию.

## Что должно быть сделано

1. Реактивация всегда записывает `subscriptionId` (null или новый) и `paymentId = null` (новый платёж привяжется ниже).
2. Тест сценария из ревью.

## Критерии приёмки

- ✅ После сценария used возвращается к исходному значению при отмене
- ✅ `payment_id` указывает на новый платёж

## Подсказки

- Старый pending-платёж отменяется при отмене брони (6.8.6).

## Не делать

- ❌ Не создавать вторую строку брони
