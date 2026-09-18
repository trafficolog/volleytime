---
id: '6.8.4'
phase: '6'
epic: '6.8'
status: done
sync_state: synced
last_reviewed: 2026-09-16
status_note: ''
review_ref: 'Phase 6 · P1 #4'
priority: P1
roles:
  - BACK
depends_on:
  - '6.8.1'
estimated_hours: '1'
tags:
  - payments
  - waitlist
  - review-fix
---

# Task 6.8.4: Отклонение оплаты брони освобождает место через bookingService.cancel (промоушен)

## Цель

После отклонения оплаты первый из листа ожидания получает место.

## Контекст

`reject` менял статус брони напрямую — место свободно, лист ожидания стоит.

## Что должно быть сделано

1. `reject` для брони: `bookingService.cancel({…tx}, bookingId, { byAdmin: true, allowAfterStart: false })` в той же транзакции.
2. Тест: capacity 1, cash + waitlist → reject → второй `pending_payment` с платежом.

## Критерии приёмки

- ✅ Лист ожидания продвигается после отклонения

## Подсказки

- Цикл импортов payments↔bookings: вызов через ленивый `import()` или передача колбэка — выбрать и описать.

## Не делать

- ❌ Не дублировать логику промоушена
