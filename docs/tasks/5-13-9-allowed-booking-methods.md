---
id: '5.13.9'
phase: '5'
epic: '5.13'
status: done
sync_state: synced
last_reviewed: 2026-09-16
status_note: ''
review_ref: 'Phase 5 · P1 #9'
priority: P1
roles:
  - BACK
  - SECURITY
depends_on: []
estimated_hours: '1'
tags:
  - bookings
  - payments
  - review-fix
---

# Task 5.13.9: Методы записи допустимы для цены: free — только бесплатные, online — запрещён до Phase 12

## Цель

Место на платном событии нельзя занять без платежа.

## Контекст

`method: free|online` на платном событии → `pending_payment` без платежа.

## Что должно быть сделано

1. `price = 0` → только `free` (или игнор метода); `price > 0` → `subscription|cash|transfer`; `online` → 422 `booking.method_not_allowed`.
2. Лист ожидания на платное событие: тот же набор методов.
3. Тесты на матрицу.

## Критерии приёмки

- ✅ `free` на платном → 422
- ✅ `online` → 422

## Подсказки

- Онлайн-оплата — Phase 12.

## Не делать

- ❌ Не создавать бронь без платежа или списания для платного события
